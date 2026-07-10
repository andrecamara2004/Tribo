// src/pages/ActivitiesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listActivities, type Activity, type EventKind } from "../api/activities";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { statusPillClass, statusLabel, formatWhen } from "../lib/activity";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];

type KindFilter = "ALL" | EventKind;
const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "RUN", label: "Runs" },
];

export function ActivitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [pages, setPages] = useState<Activity[][]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Initial load. Self-contained in the effect (no setState before the await)
  // so it doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await listActivities({ status: "PUBLISHED", limit: 8 });
        if (cancelled) return;
        setPages([page.items]);
        setPageIndex(0);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor != null);
        setItems(page.items);
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

  async function loadNextPage() {
    if (pageIndex < pages.length - 1) {
      setPageIndex((prev) => prev + 1);
      setItems(pages[pageIndex + 1]);
      return;
    }

    if (!cursor || loading) return;

    setError(null);
    try {
      const page = await listActivities({ status: "PUBLISHED", limit: 8, cursor });
      const nextPage = page.items;
      setPages((prev) => {
        const next = [...prev, nextPage];
        setItems(nextPage);
        setPageIndex(next.length - 1);
        return next;
      });
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor != null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load activities.");
    }
  }

  function goToPage(index: number) {
    if (index < 0 || index >= pages.length) return;
    setPageIndex(index);
    setItems(pages[index]);
  }

  // Client-side filter by event type and search text.
  const visible = useMemo(() => {
    const byKind = kind === "ALL" ? items : items.filter((a) => a.eventKind === kind);
    const query = searchQuery.trim().toLowerCase();

    if (!query) return byKind;

    return byKind.filter((a) => {
      const haystack = [
        a.title,
        a.location,
        a.description,
        a.category,
        ...(a.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, kind, searchQuery]);

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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search activities..."
          style={{
            minWidth: 240,
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
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

      {loading && <p className="state-msg">Loading activities…</p>}
      {error && <p className="state-msg error">{error}</p>}
      {!loading && visible.length === 0 && <p className="state-msg">No activities found.</p>}

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
                {a.eventKind === "VOLUNTEER" && a.pointsParticipant ? (
                  <span className="pill">+{a.pointsParticipant} pts</span>
                ) : null}
                {a.eventKind === "VOLUNTEER" && (
                  <span className={a.verifiedBy === "PARTNER" ? "pill partner" : "pill"}>
                    {a.verifiedBy === "PARTNER" ? "🏛️ Partner-verified" : "👥 Peer-verified"}
                  </span>
                )}
                {a.userRole && <span className="pill gold">You're in</span>}
              </div>
            </div>

            {a.description && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                {a.description.length > 140 ? a.description.slice(0, 140) + "…" : a.description}
              </p>
            )}

            <div className="vol-meta">
              <div><Icon name="pin" size={14} /> {a.location || "—"}</div>
              {a.eventKind === "VOLUNTEER" && a.distanceKm ? (
                <div><Icon name="ruler" size={14} /> {a.distanceKm} km</div>
              ) : null}
              <div>
                <Icon name="users" size={14} />
                {a.eventKind === "VOLUNTEER"
                  ? ` ${a.participantsJoined ?? 0}/${a.capacity} · ${a.staffJoined ?? 0}/${a.staffCapacity} staff`
                  : ` ${a.capacity} spots`}
              </div>
            </div>

            {a.tags && a.tags.length > 0 && (
              <div className="vol-tags">
                {a.tags.map((t) => <span key={t} className="pill gray">{t}</span>)}
              </div>
            )}

            <div className="vol-foot">
              <span className="when" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="clock" size={13} /> ends {formatWhen(a.endsAt)}
              </span>
              <span className="btn btn-secondary">View details →</span>
            </div>
          </article>
        ))}
      </div>

      {!loading && !searchQuery.trim() && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0}>
            Previous
          </button>
          <span className="sub">Page {pageIndex + 1}</span>
          <button className="btn btn-secondary" onClick={loadNextPage} disabled={!hasMore && pageIndex >= pages.length - 1}>
            Next
          </button>
        </div>
      )}
    </Shell>
  );
}
