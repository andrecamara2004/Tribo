// src/pages/FindActivityPage.tsx
// "Find activities" — all published activities as pins on one map, with a side
// list. Backend already returns lat/lng on the activities list; this is map-only.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import { listActivities, type Activity } from "../api/activities";
import { Shell } from "../components/Shell";
import { ActivitiesMap, type MapPoint } from "../components/MapView";
import { Icon } from "../components/Icon";
import { formatWhen } from "../lib/activity";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

type LocationFilter = {
  label: string;
  latitude: number;
  longitude: number;
  zoom: number;
  viewport?: { north: number; south: number; east: number; west: number } | null;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function FindActivityPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: "tribo-find-activities",
    googleMapsApiKey: MAPS_KEY ?? "",
    libraries: ["places"],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await listActivities({ status: "PUBLISHED", limit: 100 });
        if (!cancelled) setItems(page.items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["(cities)"],
      fields: ["formatted_address", "geometry", "name"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const geometry = place.geometry?.location;
      const viewport = place.geometry?.viewport;
      if (!geometry) return;

      const nextFilter: LocationFilter = {
        label: place.formatted_address ?? place.name ?? "Selected location",
        latitude: geometry.lat(),
        longitude: geometry.lng(),
        zoom: viewport ? 10 : 13,
        viewport: viewport
          ? {
            north: viewport.getNorthEast().lat(),
            south: viewport.getSouthWest().lat(),
            east: viewport.getNorthEast().lng(),
            west: viewport.getSouthWest().lng(),
          }
          : null,
      };
      setLocationFilter(nextFilter);
      setSelectedId(null);
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isLoaded]);

  const filteredItems = useMemo(() => {
    if (!locationFilter) return items;

    return items.filter((a) => {
      if (a.latitude == null || a.longitude == null) return false;
      if (locationFilter.viewport) {
        return (
          a.latitude <= locationFilter.viewport.north &&
          a.latitude >= locationFilter.viewport.south &&
          a.longitude <= locationFilter.viewport.east &&
          a.longitude >= locationFilter.viewport.west
        );
      }

      const distance = haversineKm(
        a.latitude,
        a.longitude,
        locationFilter.latitude,
        locationFilter.longitude,
      );
      return distance <= 40;
    });
  }, [items, locationFilter]);

  const located = filteredItems.filter((a) => a.latitude != null && a.longitude != null);
  const points: MapPoint[] = located.map((a) => ({
    id: a.id,
    title: a.title,
    location: a.location,
    latitude: a.latitude as number,
    longitude: a.longitude as number,
    kind: a.eventKind,
  }));

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Find activities</h1>
          <div className="sub">{located.length} of {items.length} activities have a location pin</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search a city or place"
          style={{
            minWidth: 260,
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => {
            setLocationFilter(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Clear
        </button>
      </div>

      {locationFilter && (
        <div className="sub" style={{ marginBottom: 12 }}>
          Showing activities in <strong>{locationFilter.label}</strong>
        </div>
      )}

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : (
        <div className="find-layout">
          <div className="find-list">
            {filteredItems.length === 0 && <p className="state-msg">No activities found for this location.</p>}
            {filteredItems.map((a) => {
              const hasLoc = a.latitude != null && a.longitude != null;
              return (
                <button
                  key={a.id}
                  className={"find-row " + (a.id === selectedId ? "active" : "")}
                  onClick={() => (hasLoc ? setSelectedId(a.id) : navigate(`/activities/${a.id}`))}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{a.title}</strong>
                    <small>{formatWhen(a.startsAt)}{a.location ? ` · ${a.location}` : ""}</small>
                  </div>
                  {hasLoc ? <Icon name="pin" size={16} /> : <span className="pill gray">no pin</span>}
                </button>
              );
            })}
          </div>

          <div className="find-map">
            {points.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", textAlign: "center", padding: 16 }}>
                No activities have a map pin yet. Add coordinates when creating an activity.
              </div>
            ) : (
              <ActivitiesMap
                points={points}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onView={(id) => navigate(`/activities/${id}`)}
                focusLocation={locationFilter ? { latitude: locationFilter.latitude, longitude: locationFilter.longitude, zoom: locationFilter.zoom } : null}
              />
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
