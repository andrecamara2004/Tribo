// src/pages/ActivitiesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listActivities, type Activity } from "../api/activities";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { statusPillClass, statusLabel, formatWhen } from "../lib/activity";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];

export function ActivitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("All");

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

  // Distinct categories present in the loaded data → client-side filter chips.
  const categories = useMemo(() => {
    const set = new Set(items.map((a) => a.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  const visible = category === "All" ? items : items.filter((a) => a.category === category);

  const canManage = user != null && MANAGER_ROLES.includes(user.role);

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Activities</h1>
          <div className="sub">Volunteer runs and clean-up events near you</div>
        </div>
        <div className="right">
          {canManage ? (
            <div className="host-cluster">
              <button className="btn btn-primary" onClick={() => navigate("/activities/new")}>
                <Icon name="plus" size={16} /> Host an event
              </button>
              <small className="role-note">As {user!.role.replace(/_/g, " ").toLowerCase()}, you can host</small>
            </div>
          ) : (
            <div className="host-cluster">
              <button className="btn btn-secondary" disabled title="Activity Managers and Partners can host">
                <Icon name="plus" size={16} /> Host an event
              </button>
              <small className="role-note">Activity Managers &amp; Partners only</small>
            </div>
          )}
        </div>
      </div>

      {user?.verified === false && canManage && (
        <div className="eligibility-banner warn">
          <Icon name="leaf" size={16} />
          Your account is pending backoffice verification — you can browse, but creating
          activities will be rejected until you're verified.
        </div>
      )}

      {categories.length > 1 && (
        <div className="vol-filters">
          {categories.map((c) => (
            <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="state-msg">Loading activities…</p>}
      {error && <p className="state-msg error">{error}</p>}
      {!loading && visible.length === 0 && <p className="state-msg">No activities yet.</p>}

      <div className="vol-grid">
        {visible.map((a) => (
          <article
            key={a.id}
            className="vol-card"
            onClick={() => navigate(`/activities/${a.id}`)}
            style={{ cursor: "pointer" }}
          >
            <div className="vol-head">
              <div style={{ minWidth: 0 }}>
                <h3>{a.title}</h3>
                <div className="when">{formatWhen(a.startsAt)}</div>
              </div>
              <div className="vol-head-tags">
                <span className={statusPillClass(a.status)}>{statusLabel(a.status)}</span>
                {a.category && <span className="pill gray">{a.category}</span>}
              </div>
            </div>

            {a.description && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                {a.description.length > 140 ? a.description.slice(0, 140) + "…" : a.description}
              </p>
            )}

            <div className="vol-meta">
              <div><Icon name="pin" size={14} /> {a.location || "—"}</div>
              <div><Icon name="users" size={14} /> {a.capacity} spots</div>
            </div>

            <div className="vol-foot">
              <span className="when" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="clock" size={13} /> ends {formatWhen(a.endsAt)}
              </span>
              <span className="btn btn-secondary">View details →</span>
            </div>
          </article>
        ))}
      </div>

      {cursor && !loading && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={loadMore}>
            Load more
          </button>
        </div>
      )}
    </Shell>
  );
}
