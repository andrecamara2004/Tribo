// src/pages/ActivitiesPage.tsx
import { useEffect, useState } from "react";
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
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const page = await listActivities({ status: "PUBLISHED" });

        if (cancelled) return;

        setItems(page.items);
        setCursor(page.nextCursor);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load activities.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    setError(null);

    try {
      const page = await listActivities({
        status: "PUBLISHED",
        cursor,
      });

      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load activities.");
    }
  }

  const visible =
    kind === "ALL"
      ? items
      : items.filter((a) => a.eventKind === kind);

  const canManage =
    user != null &&
    MANAGER_ROLES.includes(user.role);

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Activities</h1>
          <div className="sub">
            Volunteer runs and clean-up events near you
          </div>
        </div>

        <div className="right">
          {canManage ? (
            <div className="host-cluster">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/activities/new")}
              >
                <Icon name="plus" size={16} /> Host an event
              </button>

              <small className="role-note">
                As {user!.role.replace(/_/g, " ").toLowerCase()}, you can host
              </small>
            </div>
          ) : (
            <div className="host-cluster">
              <button
                className="btn btn-secondary"
                disabled
                title="Activity Managers and Partners can host"
              >
                <Icon name="plus" size={16} /> Host an event
              </button>

              <small className="role-note">
                Activity Managers &amp; Partners only
              </small>
            </div>
          )}
        </div>
      </div>

      {user?.verified === false && canManage && (
        <div className="eligibility-banner warn">
          <Icon name="leaf" size={16} />
          Your account is pending backoffice verification — you can browse,
          but creating activities will be rejected until you're verified.
        </div>
      )}

      <div
        className="kind-filter"
        role="tablist"
        aria-label="Filter activities by type"
      >
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

      {loading && (
        <p className="state-msg">Loading activities…</p>
      )}

      {error && (
        <p className="state-msg error">{error}</p>
      )}

      {!loading && visible.length === 0 && (
        <p className="state-msg">No activities yet.</p>
      )}

      <div className="vol-grid">
        {visible.map((a) => (
          <article
            key={a.id}
            className="vol-card"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/activities/${a.id}`)}
          >
            <div className="vol-head">
              <div style={{ minWidth: 0 }}>
                <h3>{a.title}</h3>

                <div className="when">
                  {formatWhen(a.startsAt)}
                </div>
              </div>

              <div className="vol-head-tags">
                <span className={statusPillClass(a.status)}>
                  {statusLabel(a.status)}
                </span>

                {a.eventKind === "VOLUNTEER" &&
                  a.pointsParticipant ? (
                  <span className="pill">
                    +{a.pointsParticipant} pts
                  </span>
                ) : null}

                {a.eventKind === "VOLUNTEER" && (
                  <span
                    className={
                      a.verifiedBy === "PARTNER"
                        ? "pill partner"
                        : "pill"
                    }
                  >
                    {a.verifiedBy === "PARTNER"
                      ? "🏛️ Partner-verified"
                      : "👥 Peer-verified"}
                  </span>
                )}

                {a.userRole && (
                  <span className="pill gold">
                    You're in
                  </span>
                )}
              </div>
            </div>

            {a.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                {a.description.length > 140
                  ? a.description.slice(0, 140) + "…"
                  : a.description}
              </p>
            )}

            <div className="vol-meta">
              <div>
                <Icon name="pin" size={14} />{" "}
                {a.location || "—"}
              </div>

              {a.eventKind === "VOLUNTEER" &&
                a.distanceKm ? (
                <div>
                  <Icon name="ruler" size={14} />{" "}
                  {a.distanceKm} km
                </div>
              ) : null}

              <div>
                <Icon name="users" size={14} />
                {a.eventKind === "VOLUNTEER"
                  ? ` ${a.participantsJoined ?? 0}/${a.capacity} · ${a.staffJoined ?? 0}/${a.staffCapacity} staff`
                  : ` ${a.capacity} spots`}
              </div>
            </div>

            {/* Review Code */}
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "#555",
                fontWeight: 500,
              }}
            >
              ⭐ {a.averageRating?.toFixed(1) ?? "0.0"} ·{" "}
              {a.reviewCount ?? 0} review
              {(a.reviewCount ?? 0) !== 1 ? "s" : ""}
            </div>

            {a.tags.length > 0 && (
              <div className="vol-tags">
                {a.tags.map((t) => (
                  <span
                    key={t}
                    className="pill gray"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="vol-foot">
              <span
                className="when"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="clock" size={13} />
                ends {formatWhen(a.endsAt)}
              </span>

              <span className="btn btn-secondary">
                View details →
              </span>
            </div>
          </article>
        ))}
      </div>

      {cursor && !loading && (
        <div style={{ marginTop: 20 }}>
          <button
            className="btn btn-secondary"
            onClick={loadMore}
          >
            Load more
          </button>
        </div>
      )}
    </Shell>
  );
}