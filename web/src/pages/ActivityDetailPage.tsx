// src/pages/ActivityDetailPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  getActivity,
  getRoster,
  joinActivity,
  withdrawFromActivity,
  cancelActivity,
  type Activity,
  type Roster,
} from "../api/activities";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { statusPillClass, statusLabel, formatWhen } from "../lib/activity";

const PRIVILEGED = ["BACKOFFICE", "SYSADMIN"];

export function ActivityDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
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
        const owner = user && (user.userId === a.ownerId || PRIVILEGED.includes(user.role));
        if (owner) setRoster(await getRoster(id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load activity.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(ok);
      if (isOwner) setRoster(await getRoster(id)); // refresh roster after changes
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

  if (loading)
    return (
      <Shell>
        <p className="state-msg">Loading…</p>
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
            <dd>{activity.capacity} spots</dd>
            <dt>Description</dt>
            <dd>{activity.description || "—"}</dd>
          </dl>
        </div>

        {notice && <p className="form-notice" style={{ marginTop: 16 }}>{notice}</p>}
        {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

        <div className="action-row">
          <button
            className="btn btn-primary"
            disabled={busy || !joinable}
            onClick={() => act(() => joinActivity(id), "You're registered for this activity.")}
          >
            Join
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => act(() => withdrawFromActivity(id), "You've withdrawn from this activity.")}
          >
            Withdraw
          </button>

          {isOwner && (
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => navigate(`/activities/${id}/edit`)}>
                Edit
              </button>
              {activity.status !== "CANCELLED" && (
                <button className="btn btn-danger" disabled={busy} onClick={onCancel}>
                  Cancel activity
                </button>
              )}
            </>
          )}
        </div>

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
