// src/pages/FindActivityPage.tsx
// "Find activities" — all published activities as pins on one map, with a side
// list. Backend already returns lat/lng on the activities list; this is map-only.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listActivities, type Activity, type EventKind } from "../api/activities";
import { Shell } from "../components/Shell";
import { ActivitiesMap, type MapPoint } from "../components/MapView";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { formatWhen } from "../lib/activity";
import { getCurrentPosition, type Coords } from "../lib/geo";

type KindFilter = "ALL" | EventKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "RUN", label: "Runs" },
];

const RADII = [5, 10, 25, 50];

export function FindActivityPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [near, setNear] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const page = await listActivities({
          status: "PUBLISHED",
          limit: 100,
          q: query,
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
  }, [query, kind, near, radiusKm]);

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

  const located = items.filter((a) => a.latitude != null && a.longitude != null);
  const points: MapPoint[] = located.map((a) => ({
    id: a.id, title: a.title, location: a.location,
    latitude: a.latitude as number, longitude: a.longitude as number,
    eventKind: a.eventKind,
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
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by title, place, host or tag…"
            aria-label="Search activities"
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

        <div className="map-legend">
          <span><i className="dot volunteer" /> Volunteer</span>
          <span><i className="dot run" /> Runs</span>
        </div>
      </div>

      {geoError && <p className="state-msg error">{geoError}</p>}

      {loading ? (
        <Spinner label="Loading…" />
      ) : (
        <div className="find-layout">
          <div className="find-list">
            {items.length === 0 && <p className="state-msg">No activities yet.</p>}
            {items.map((a) => {
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
              />
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
