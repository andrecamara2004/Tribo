// src/pages/FindActivityPage.tsx
// "Find activities" — all published activities as pins on one map, with a side
// list. Two ways to locate: a Google Places city search that re-centers/filters
// the map, and a "Near me" GPS toggle that filters server-side by radius.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listActivities, type Activity, type EventKind } from "../api/activities";
import { Shell } from "../components/Shell";
import { ActivitiesMap, type MapPoint } from "../components/MapView";
import { useMapsLoader } from "../lib/maps";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { formatWhen, isEnded } from "../lib/activity";
import { getCurrentPosition, type Coords } from "../lib/geo";

type KindFilter = "ALL" | EventKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "RUN", label: "Runs" },
];

const RADII = [5, 10, 25, 50];

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
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [near, setNear] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter | null>(null);

  const { isLoaded } = useMapsLoader();

  // Server-side filters: type + optional GPS radius. Place search is layered on
  // top client-side (below), so it isn't part of this dependency list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const page = await listActivities({
          status: "PUBLISHED",
          limit: 100,
          eventKind: kind,
          nearLat: near?.lat,
          nearLng: near?.lng,
          radiusKm: near ? radiusKm : undefined,
        });
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
  }, [kind, near, radiusKm]);

  // Google Places city/place autocomplete → re-center the map + filter the list.
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

  async function toggleNear() {
    setGeoError(null);
    if (near) {
      setNear(null);
      return;
    }
    setGeoBusy(true);
    try {
      setNear(await getCurrentPosition());
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setGeoBusy(false);
    }
  }

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

      <div className="activities-filters">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search a city or place…"
            aria-label="Search by city or place"
          />
        </div>

        <div className="kind-filter" role="tablist" aria-label="Filter activities by type">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={kind === f.value}
              className={kind === f.value ? "active" : ""}
              onClick={() => setKind(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          className={"btn btn-secondary near-btn" + (near ? " active" : "")}
          onClick={toggleNear}
          disabled={geoBusy}
          title="Show activities near your current location"
        >
          {geoBusy ? <Spinner size={14} /> : <Icon name="pin" size={14} />}{" "}
          {near ? "Near me: on" : "Near me"}
        </button>

        {near && (
          <select
            className="distance-filter"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-label="Proximity radius"
          >
            {RADII.map((r) => (
              <option key={r} value={r}>within {r} km</option>
            ))}
          </select>
        )}

        {locationFilter && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLocationFilter(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Clear place
          </button>
        )}

        <div className="map-legend">
          <span><i className="dot volunteer" /> Volunteer</span>
          <span><i className="dot run" /> Runs</span>
        </div>
      </div>

      {geoError && <p className="state-msg error">{geoError}</p>}

      {locationFilter && (
        <div className="sub" style={{ marginBottom: 12 }}>
          Showing activities in <strong>{locationFilter.label}</strong>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading…" />
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
                  {a.status !== "CANCELLED" && isEnded(a.endsAt) && (
                    <span className="pill gray">Ended</span>
                  )}
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
