// src/components/MapView.tsx
// Google Maps for event locations. Reads the JS API key from
// VITE_GOOGLE_MAPS_API_KEY (build-time). Degrades to a friendly placeholder
// when no key is configured, so the app still builds/runs without one.
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from "@react-google-maps/api";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const CONTAINER = { width: "100%", height: "100%" };
const LISBON = { lat: 38.7223, lng: -9.1393 };

type LatLng = { lat: number; lng: number };

/** A located activity for the discovery map. */
export interface MapPoint {
  id: string;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  kind?: "VOLUNTEER" | "RUN";
}

function Placeholder({ note }: { note: string }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--muted)", fontSize: 13, background: "var(--bg)", textAlign: "center", padding: 12,
    }}>
      {note}
    </div>
  );
}

function MapImpl({
  center, marker, onPick,
}: {
  center: LatLng;
  marker: LatLng | null;
  onPick?: (lat: number, lng: number) => void;
}) {
  const { isLoaded, loadError } = useJsApiLoader({ id: "tribo-gmaps", googleMapsApiKey: KEY! });
  if (loadError) return <Placeholder note="Map failed to load — check the API key / billing." />;
  if (!isLoaded) return <Placeholder note="Loading map…" />;
  return (
    <GoogleMap
      mapContainerStyle={CONTAINER}
      center={center}
      zoom={14}
      onClick={onPick ? (e) => e.latLng && onPick(e.latLng.lat(), e.latLng.lng()) : undefined}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {marker && <MarkerF position={marker} />}
    </GoogleMap>
  );
}

/** Read-only map with a pin at the given coordinates. */
export function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  if (!KEY) return <Placeholder note="Map unavailable — set VITE_GOOGLE_MAPS_API_KEY." />;
  return <MapImpl center={{ lat, lng }} marker={{ lat, lng }} />;
}

/** Map of many activities as pins, with an info window + "view" action. */
export function ActivitiesMap({
  points, selectedId, onSelect, onView, focusLocation,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onView: (id: string) => void;
  focusLocation?: { latitude: number; longitude: number; zoom: number } | null;
}) {
  if (!KEY) return <Placeholder note="Map unavailable — set VITE_GOOGLE_MAPS_API_KEY." />;
  return <ActivitiesMapImpl points={points} selectedId={selectedId} onSelect={onSelect} onView={onView} focusLocation={focusLocation} />;
}

function ActivitiesMapImpl({
  points, selectedId, onSelect, onView, focusLocation,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onView: (id: string) => void;
  focusLocation?: { latitude: number; longitude: number; zoom: number } | null;
}) {
  const { isLoaded, loadError } = useJsApiLoader({ id: "tribo-gmaps", googleMapsApiKey: KEY! });
  if (loadError) return <Placeholder note="Map failed to load — check the API key / billing." />;
  if (!isLoaded) return <Placeholder note="Loading map…" />;

  // Fit the viewport to all pins on load (or center on the single pin).
  const onLoad = (map: google.maps.Map) => {
    if (focusLocation) {
      map.setCenter({ lat: focusLocation.latitude, lng: focusLocation.longitude });
      map.setZoom(focusLocation.zoom);
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setCenter({ lat: points[0].latitude, lng: points[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds);
  };

  const selected = points.find((p) => p.id === selectedId) ?? null;

  return (
    <GoogleMap
      mapContainerStyle={CONTAINER}
      center={LISBON}
      zoom={12}
      onLoad={onLoad}
      onClick={() => onSelect(null)}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {points.map((p) => {
        const icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: p.kind === "RUN" ? "#2563eb" : "#16a34a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        };

        return (
          <MarkerF
            key={p.id}
            position={{ lat: p.latitude, lng: p.longitude }}
            onClick={() => onSelect(p.id)}
            icon={icon}
          />
        );
      })}
      {selected && (
        <InfoWindowF
          position={{ lat: selected.latitude, lng: selected.longitude }}
          onCloseClick={() => onSelect(null)}
        >
          <div style={{ maxWidth: 200, color: "#1b1b1b" }}>
            <strong style={{ fontSize: 14 }}>{selected.title}</strong>
            {selected.location && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{selected.location}</div>}
            <button
              onClick={() => onView(selected.id)}
              style={{
                marginTop: 8, background: "#00B86B", color: "#fff", border: "none",
                borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              View details →
            </button>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}

/** Click-to-place picker; calls onPick with the chosen coordinates. */
export function LocationPicker({
  lat, lng, onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  if (!KEY) return <Placeholder note="Map picker unavailable — set VITE_GOOGLE_MAPS_API_KEY." />;
  const has = lat != null && lng != null;
  return (
    <MapImpl
      center={has ? { lat: lat!, lng: lng! } : LISBON}
      marker={has ? { lat: lat!, lng: lng! } : null}
      onPick={onPick}
    />
  );
}
