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

  if (loading) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</p>;
  if (error && !activity) return <p style={{ padding: 24, color: "crimson" }}>{error}</p>;
  if (!activity) return null;

  const past = started;
  const joinable = activity.status === "PUBLISHED" && !past;

  return (
    <div style={{ maxWidth: 640, margin: "48px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <Link to="/activities">← Back</Link>
      <h1>{activity.title}</h1>
      <p style={{ color: "#555" }}>
        Status: <strong>{activity.status}</strong>
        {past && activity.status === "PUBLISHED" && " (already started)"}
      </p>

      <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6 }}>
        <dt>When</dt><dd>{new Date(activity.startsAt).toLocaleString()} → {new Date(activity.endsAt).toLocaleString()}</dd>
        <dt>Where</dt><dd>{activity.location || "—"}</dd>
        <dt>Category</dt><dd>{activity.category || "—"}</dd>
        <dt>Capacity</dt><dd>{activity.capacity}</dd>
        <dt>Description</dt><dd>{activity.description || "—"}</dd>
      </dl>

      {notice && <p style={{ color: "green" }}>{notice}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          disabled={busy || !joinable}
          onClick={() => act(() => joinActivity(id), "You're registered for this activity.")}
          style={{ padding: "8px 12px" }}
        >
          Join
        </button>
        <button
          disabled={busy}
          onClick={() => act(() => withdrawFromActivity(id), "You've withdrawn from this activity.")}
          style={{ padding: "8px 12px" }}
        >
          Withdraw
        </button>

        {isOwner && (
          <>
            <button disabled={busy} onClick={() => navigate(`/activities/${id}/edit`)} style={{ padding: "8px 12px" }}>
              Edit
            </button>
            {activity.status !== "CANCELLED" && (
              <button disabled={busy} onClick={onCancel} style={{ padding: "8px 12px", color: "crimson" }}>
                Cancel activity
              </button>
            )}
          </>
        )}
      </div>

      {isOwner && roster && (
        <div style={{ marginTop: 24 }}>
          <h2>Participants ({roster.count})</h2>
          {roster.participants.length === 0 ? (
            <p>No one has joined yet.</p>
          ) : (
            <ul>
              {roster.participants.map((p) => (
                <li key={p.userId}>
                  <code>{p.userId}</code> — {new Date(p.joinedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
