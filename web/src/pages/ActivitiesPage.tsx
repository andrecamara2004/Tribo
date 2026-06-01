// src/pages/ActivitiesPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listActivities, type Activity } from "../api/activities";
import { ApiError } from "../api/http";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];

export function ActivitiesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load. Self-contained in the effect (no setState before the await)
  // so it doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await listActivities({ status: "PUBLISHED" });
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load activities.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // "Load more" — appends the next page. Triggered by a button, not an effect.
  async function loadMore() {
    setError(null);
    try {
      const page = await listActivities({ status: "PUBLISHED", cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load activities.");
    }
  }

  const canManage = user != null && MANAGER_ROLES.includes(user.role);

  return (
    <div style={{ maxWidth: 640, margin: "48px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Activities</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {canManage && (
            <button onClick={() => navigate("/activities/new")} style={{ padding: "8px 12px" }}>
              + Create
            </button>
          )}
          <button onClick={async () => { await logout(); navigate("/login"); }} style={{ padding: "8px 12px" }}>
            Log out
          </button>
        </div>
      </div>

      {user?.verified === false && canManage && (
        <p style={{ background: "#fff3cd", padding: 12, borderRadius: 6 }}>
          Your account is pending backoffice verification. You can browse, but creating activities
          will be rejected until you're verified.
        </p>
      )}

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && items.length === 0 && <p>No activities yet.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((a) => (
          <li key={a.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <Link to={`/activities/${a.id}`} style={{ fontSize: 18, fontWeight: 600, textDecoration: "none" }}>
              {a.title}
            </Link>
            <div style={{ color: "#555", marginTop: 4 }}>
              {new Date(a.startsAt).toLocaleString()} · {a.location || "—"} · cap {a.capacity}
            </div>
            {a.category && <div style={{ color: "#888", fontSize: 13 }}>{a.category}</div>}
          </li>
        ))}
      </ul>

      {cursor && !loading && (
        <button onClick={loadMore} style={{ padding: "8px 12px" }}>
          Load more
        </button>
      )}
    </div>
  );
}
