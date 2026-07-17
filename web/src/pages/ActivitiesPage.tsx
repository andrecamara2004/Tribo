// src/pages/ActivitiesPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listActivities, type Activity, type EventKind } from "../api/activities";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { statusPillClass, statusLabel, formatWhen, isEnded } from "../lib/activity";
import { getCurrentPosition, type Coords } from "../lib/geo";

const MANAGER_ROLES = ["ACTIVITY_MANAGER", "PARTNER", "SYSADMIN"];

const PAGE_SIZE = 12;

type KindFilter = "ALL" | EventKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "RUN", label: "Runs" },
];

// Upper-bound distance buckets for the distance filter (null = any).
const DISTANCE_FILTERS: { value: number | null; label: string }[] = [
  { value: null, label: "Any distance" },
  { value: 5, label: "≤ 5 km" },
  { value: 10, label: "≤ 10 km" },
  { value: 21, label: "≤ 21 km" },
  { value: 42, label: "≤ 42 km" },
];

const RADII = [5, 10, 25, 50];

export function ActivitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Numbered pagination over server-filtered pages: `pages` holds every page
  // fetched so far, `pageIndex` is the one on screen. Changing any filter resets
  // back to page 1 (the load effect below).
  const [pages, setPages] = useState<Activity[][]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<KindFilter>("ALL");
  const [maxKm, setMaxKm] = useState<number | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [near, setNear] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [geoBusy, setGeoBusy] = useState(false);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  // (Re)load page 1 whenever any filter changes. The server does the filtering,
  // so numbered paging stays correct (unlike a client-side filter).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await listActivities({
          status: "PUBLISHED",
          limit: PAGE_SIZE,
          q: query,
          eventKind: kind,
          maxDistanceKm: maxKm ?? undefined,
          nearLat: near?.lat,
          nearLng: near?.lng,
          radiusKm: near ? radiusKm : undefined,
        });

        if (cancelled) return;

        setPages([page.items]);
        setPageIndex(0);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor != null);
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
  }, [query, kind, maxKm, near, radiusKm]);

  async function loadNextPage() {
    // Already fetched — just move forward.
    if (pageIndex < pages.length - 1) {
      setPageIndex((i) => i + 1);
      return;
    }
    if (!cursor || loading) return;

    setError(null);
    try {
      const page = await listActivities({
        status: "PUBLISHED",
        limit: PAGE_SIZE,
        cursor,
        q: query,
        eventKind: kind,
        maxDistanceKm: maxKm ?? undefined,
        nearLat: near?.lat,
        nearLng: near?.lng,
        radiusKm: near ? radiusKm : undefined,
      });
      setPages((prev) => [...prev, page.items]);
      setPageIndex((i) => i + 1);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor != null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load activities.");
    }
  }

  function goToPrevPage() {
    if (pageIndex > 0) setPageIndex((i) => i - 1);
  }

  async function toggleNear() {
    setError(null);
    if (near) {
      setNear(null);
      return;
    }
    setGeoBusy(true);
    try {
      setNear(await getCurrentPosition());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setGeoBusy(false);
    }
  }

  const visible = pages[pageIndex] ?? [];
  const hasFilters = query !== "" || kind !== "ALL" || maxKm != null || near != null;
  const showPager = !loading && (pageIndex > 0 || hasMore || pages.length > 1);

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

        <select
          className="distance-filter"
          value={maxKm ?? ""}
          onChange={(e) => setMaxKm(e.target.value === "" ? null : Number(e.target.value))}
          aria-label="Filter activities by distance"
        >
          {DISTANCE_FILTERS.map((d) => (
            <option key={d.label} value={d.value ?? ""}>
              {d.label}
            </option>
          ))}
        </select>

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
      </div>

      {loading && <Spinner cover label="Loading activities…" />}

      {error && (
        <p className="state-msg error">{error}</p>
      )}

      {!loading && visible.length === 0 && (
        <p className="state-msg">
          {hasFilters
            ? "No activities match your filters."
            : "No activities yet."}
        </p>
      )}

      <div className="vol-grid">
        {visible.map((a) => (
          <article
            key={a.id}
            className={"vol-card" + (a.status !== "CANCELLED" && isEnded(a.endsAt) ? " ended" : "")}
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

                {a.status !== "CANCELLED" && isEnded(a.endsAt) && (
                  <span className="pill gray">Ended</span>
                )}

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

            {/* ⭐ Review Code */}
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

      {showPager && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={goToPrevPage} disabled={pageIndex === 0}>
            Previous
          </button>
          <span className="sub">Page {pageIndex + 1}</span>
          <button
            className="btn btn-secondary"
            onClick={loadNextPage}
            disabled={pageIndex >= pages.length - 1 && !hasMore}
          >
            Next
          </button>
        </div>
      )}
    </Shell>
  );
}
