// src/pages/FindActivityPage.tsx
// "Find activities" — all published activities as pins on one map, with a side
// list. Backend already returns lat/lng on the activities list; this is map-only.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listActivities, type Activity } from "../api/activities";
import { Shell } from "../components/Shell";
import { ActivitiesMap, type MapPoint } from "../components/MapView";
import { Icon } from "../components/Icon";
import { formatWhen } from "../lib/activity";

export function FindActivityPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const located = items.filter((a) => a.latitude != null && a.longitude != null);
  const points: MapPoint[] = located.map((a) => ({
    id: a.id, title: a.title, location: a.location,
    latitude: a.latitude as number, longitude: a.longitude as number,
  }));

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Find activities</h1>
          <div className="sub">{located.length} of {items.length} activities have a location pin</div>
        </div>
      </div>

      {loading ? (
        <p className="state-msg">Loading…</p>
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
