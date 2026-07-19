// src/pages/ActivityDetailPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  getActivity,
  getRoster,
  getReviews,
  submitReview,
  joinActivity,
  withdrawFromActivity,
  cancelActivity,
  type Activity,
  type Review,
  type Roster,
} from "../api/activities";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Spinner } from "../components/Spinner";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { LocationMap } from "../components/MapView";
import { statusPillClass, statusLabel, formatWhen } from "../lib/activity";

const PRIVILEGED = ["BACKOFFICE", "SYSADMIN"];

const JOINED = { background: "var(--green-50)", color: "var(--green-700)", border: "1px solid var(--green-200)" } as const;
const LOCKED = { background: "#FFF6DB", color: "#8C6D04", border: "1px solid #FBE8A6" } as const;

export function ActivityDetailPage() {
  const { id = "" } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);

  //Review const
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  // Computed once on load (Date.now() is impure — never call it during render).
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner =
    activity != null && user != null &&
    (user.userId === activity.ownerId || PRIVILEGED.includes(user.role));

  useEffect(() => {
    (async () => {
      try {
        const a = await getActivity(id);

        setActivity(a);
        setStarted(new Date(a.startsAt).getTime() < Date.now());

        const reviewData = await getReviews(id);
        setReviews(reviewData.reviews);

        const owner =
          user &&
          (user.userId === a.ownerId ||
            PRIVILEGED.includes(user.role));

        if (owner) {
          setRoster(await getRoster(id));
        }

      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to load activity."
        );
      } finally {
        setLoading(false);
      }
    })();

  }, [id]);

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(ok);
      setActivity(await getActivity(id));
      if (isOwner) setRoster(await getRoster(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!confirm("Cancel this activity? Participants will no longer be able to join.")) return;
    await act(async () => {
      const updated = await cancelActivity(id);
      setActivity(updated);
    }, "Activity cancelled.");
  }

  async function onSubmitReview() {
    try {
      await submitReview(id, {
        rating,
        comment,
      });

      const updated = await getActivity(id);
      setActivity(updated);

      const reviewData = await getReviews(id);
      setReviews(reviewData.reviews);

      setRating(5);
      setComment("");

      setNotice("Review submitted!");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to submit review."
      );
    }
  }

  if (loading)
    return (
      <Shell>
        <Spinner cover label="Loading…" />
      </Shell>
    );
  if (error && !activity)
    return (
      <Shell>
        <p className="state-msg error">{error}</p>
      </Shell>
    );
  if (!activity) return null;

  const past = started;
  const joinable = activity.status === "PUBLISHED" && !past;

  const isVol = activity.eventKind === "VOLUNTEER";
  const myRole = activity.userRole ?? null;
  const pJoined = activity.participantsJoined ?? 0;
  const sJoined = activity.staffJoined ?? 0;
  const partFull = pJoined >= activity.capacity;
  const staffFull = sJoined >= activity.staffCapacity;
  const staffEligible = profile?.staffEligible ?? false;
  const eventsToGo = Math.max(0, 3 - (profile?.volunteerEvents ?? 0));
  const verifiedLabel = activity.verifiedBy === "PARTNER" ? "🏛️ Partner-verified" : "👥 Peer-verified";

  return (
    <Shell>
      <div className="page-narrow">
        <Link to="/activities" className="back-link">
          <Icon name="back" size={15} /> Back to activities
        </Link>

        <div className="detail-head">
          <h1>{activity.title}</h1>
          <span className={statusPillClass(activity.status)}>
            {statusLabel(activity.status)}
            {past && activity.status === "PUBLISHED" && " · started"}
          </span>
        </div>

        <div className="card">
          <dl className="detail-meta">
            <dt>When</dt>
            <dd>{formatWhen(activity.startsAt)} → {formatWhen(activity.endsAt)}</dd>
            <dt>Where</dt>
            <dd>{activity.location || "—"}</dd>
            <dt>Category</dt>
            <dd>{activity.category || "—"}</dd>
            <dt>Capacity</dt>
            <dd>{activity.capacity} participant spots{isVol ? ` · ${activity.staffCapacity} staff` : ""}</dd>
            {isVol && (
              <>
                <dt>Hosted by</dt>
                <dd>{activity.host || "—"}</dd>
                <dt>Distance</dt>
                <dd>{activity.distanceKm ? `${activity.distanceKm} km` : "—"}</dd>
                <dt>Verification</dt>
                <dd>{verifiedLabel}</dd>
                {activity.tags.length > 0 && (
                  <>
                    <dt>Tags</dt>
                    <dd className="vol-tags">{activity.tags.map((t) => <span key={t} className="pill gray">{t}</span>)}</dd>
                  </>
                )}
              </>
            )}
            <dt>Description</dt>
            <dd>{activity.description || "—"}</dd>
          </dl>
        </div>

        {activity.latitude != null && activity.longitude != null && (
          <div className="map-box" style={{ marginTop: 16 }}>
            <LocationMap lat={activity.latitude} lng={activity.longitude} />
          </div>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <h3>Community Rating</h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 10,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              ⭐ {activity.averageRating?.toFixed(1) ?? "0.0"}
            </span>

            <span
              style={{
                color: "#666",
              }}
            >
              ({activity.reviewCount ?? 0} review
              {(activity.reviewCount ?? 0) !== 1 ? "s" : ""})
            </span>
          </div>
        </div>

        {notice && <p className="form-notice" style={{ marginTop: 16 }}>{notice}</p>}
        {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

        {isVol ? (
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            {/* Participants */}
            <div className="card">
              <div className="card-title">
                <h3>Participants <span style={{ color: "var(--muted)", fontWeight: 500 }}>· +{activity.pointsParticipant} pts</span></h3>
                <span className="pill gray">{pJoined}/{activity.capacity}</span>
              </div>
              {myRole === "PARTICIPANT" ? (
                <button className="btn btn-block" disabled style={JOINED}>✓ You're a participant</button>
              ) : partFull ? (
                <button className="btn btn-secondary btn-block" disabled>Event full</button>
              ) : (
                <button className="btn btn-primary btn-block" disabled={busy || !joinable || myRole !== null}
                  onClick={() => act(() => joinActivity(id, "participant"), "You joined as a participant.")}>
                  Join as participant
                </button>
              )}
            </div>

            {/* Staff */}
            {activity.staffCapacity > 0 && (
              <div className="card">
                <div className="card-title">
                  <h3>Staff <span style={{ color: "var(--muted)", fontWeight: 500 }}>· +{activity.pointsStaff} pts</span></h3>
                  <span className="pill gray">{sJoined}/{activity.staffCapacity}</span>
                </div>
                {myRole === "STAFF" ? (
                  <button className="btn btn-block" disabled style={JOINED}>✓ You're staff</button>
                ) : staffFull ? (
                  <button className="btn btn-secondary btn-block" disabled>Staff full</button>
                ) : !staffEligible ? (
                  <button className="btn btn-block" disabled style={LOCKED}>
                    Need {eventsToGo} more event{eventsToGo === 1 ? "" : "s"} to staff
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-block" disabled={busy || !joinable || myRole !== null}
                    onClick={() => act(() => joinActivity(id, "staff"), "You joined as staff.")}>
                    Join as staff
                  </button>
                )}
              </div>
            )}

            {myRole !== null && (
              <button className="btn btn-secondary" style={{ width: "auto", justifySelf: "start" }} disabled={busy}
                onClick={() => act(() => withdrawFromActivity(id), "You've withdrawn from this event.")}>
                Withdraw
              </button>
            )}
          </div>
        ) : (
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy || !joinable || myRole !== null}
              onClick={() => act(() => joinActivity(id), "You're registered for this activity.")}>
              {myRole ? "Joined" : "Join"}
            </button>
            <button className="btn btn-secondary" disabled={busy || myRole === null}
              onClick={() => act(() => withdrawFromActivity(id), "You've withdrawn from this activity.")}>
              Withdraw
            </button>
          </div>
        )}

        {isOwner && (
          <div className="action-row">
            <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(`/activities/${id}/edit`)}>
              Edit
            </button>
            {activity.status !== "CANCELLED" && (
              <button className="btn btn-danger" disabled={busy} onClick={onCancel}>
                Cancel activity
              </button>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">
            <h3>Reviews</h3>

            <small>
              {reviews.length} review
              {reviews.length !== 1 ? "s" : ""}
            </small>
          </div>

          {reviews.length === 0 ? (
            <p className="state-msg">
              No reviews yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {reviews.map((review) => (
                <div
                  key={review.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    paddingBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <strong>{review.userName}</strong>

                    <span>
                      {"⭐".repeat(review.rating)}
                    </span>
                  </div>

                  {review.comment && (
                    <p
                      style={{
                        marginTop: 8,
                        marginBottom: 6,
                      }}
                    >
                      {review.comment}
                    </p>
                  )}

                  <small
                    style={{
                      color: "#888",
                    }}
                  >
                    {new Date(review.createdAt).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>

        {past &&
          myRole &&
          !reviews.some((r) => r.userId === user?.userId) && (

            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-title">
                <h3>Leave a Review</h3>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <label>Rating</label>

                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  style={{ maxWidth: 180 }}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                  <option value={4}>⭐⭐⭐⭐ (4)</option>
                  <option value={3}>⭐⭐⭐ (3)</option>
                  <option value={2}>⭐⭐ (2)</option>
                  <option value={1}>⭐ (1)</option>
                </select>

                <label>Comment</label>

                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell others how the activity was..."
                />

                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={onSubmitReview}
                >
                  Submit Review
                </button>
              </div>
            </div>
          )}

        {isOwner && roster && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-title">
              <h3>Participants</h3>
              <small>{roster.count} joined</small>
            </div>
            {roster.participants.length === 0 ? (
              <p className="state-msg">No one has joined yet.</p>
            ) : (
              <ul className="roster-list">
                {roster.participants.map((p) => (
                  <li key={p.userId}>
                    <Avatar name={p.userId.slice(0, 2)} size="sm" />
                    <code>{p.userId}</code>
                    {p.role === "STAFF" && <span className="pill gold">staff</span>}
                    <small>{formatWhen(p.joinedAt)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
