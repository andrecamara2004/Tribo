// src/components/MapView.tsx
// Google Maps for event locations. Reads the JS API key from
// VITE_GOOGLE_MAPS_API_KEY (build-time). Degrades to a friendly placeholder
// when no key is configured, so the app still builds/runs without one.
import { useJsApiLoader, GoogleMap, MarkerF } from "@react-google-maps/api";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const CONTAINER = { width: "100%", height: "100%" };
const LISBON = { lat: 38.7223, lng: -9.1393 };

type LatLng = { lat: number; lng: number };

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
