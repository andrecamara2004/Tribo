// src/pages/BackofficePage.tsx
// Backoffice console (BACKOFFICE/SYSADMIN). Two jobs for the beta:
//   1. Platform stats overview (GET /admin/stats).
//   2. Approval queue — activities submitted by managers/partners sit in
//      PENDING_APPROVAL and are invisible in the catalog until approved here.
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listActivities, approveActivity, rejectActivity, type Activity } from "../api/activities";
import {
  getPlatformStats, listUsers, verifyUser, suspendUser, unsuspendUser,
  type PlatformStats, type AdminUser,
} from "../api/admin";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Spinner } from "../components/Spinner";
import { Icon } from "../components/Icon";
import { formatWhen } from "../lib/activity";

/** Unverified managers/partners first, then the rest, each newest-first. */
function sortUsers(users: AdminUser[]): AdminUser[] {
  const needsAction = (u: AdminUser) =>
    !u.verified && (u.role === "ACTIVITY_MANAGER" || u.role === "PARTNER");
  return [...users].sort((a, b) => {
    if (needsAction(a) !== needsAction(b)) return needsAction(a) ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function BackofficePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [pending, setPending] = useState<Activity[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadPending() {
    const page = await listActivities({ status: "PENDING_APPROVAL", limit: 100 });
    setPending(page.items);
  }

  async function reload() {
    const [s, page, us] = await Promise.all([
      getPlatformStats(),
      listActivities({ status: "PENDING_APPROVAL", limit: 100 }),
      listUsers(),
    ]);
    setStats(s);
    setPending(page.items);
    setUsers(sortUsers(us));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, page, us] = await Promise.all([
          getPlatformStats(),
          listActivities({ status: "PENDING_APPROVAL", limit: 100 }),
          listUsers(),
        ]);
        if (!cancelled) {
          setStats(s);
          setPending(page.items);
          setUsers(sortUsers(us));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load backoffice data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function moderate(a: Activity, approve: boolean) {
    setBusyId(a.id);
    setError(null);
    setNotice(null);
    try {
      await (approve ? approveActivity(a.id) : rejectActivity(a.id));
      setNotice(`${approve ? "Approved" : "Rejected"} “${a.title}”.`);
      await loadPending();
      setStats(await getPlatformStats());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function userAction(u: AdminUser, fn: () => Promise<void>, ok: string) {
    setBusyId(u.userId);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Backoffice</h1>
          <div className="sub">Platform health and the activity approval queue</div>
        </div>
      </div>

      {/* --- Platform stats --- */}
      <section className="stats-grid">
        <StatCard icon="user" label="Users" value={stats ? String(stats.totalUsers) : "—"} sub="Registered accounts" />
        <StatCard icon="leaf" label="Activities" value={stats ? String(stats.totalActivities) : "—"} sub="All statuses" />
        <StatCard icon="pin" label="Volunteer events" value={stats ? String(stats.volunteerEvents) : "—"} sub="Of all activities" />
        <StatCard icon="run" label="Runs" value={stats ? String(stats.totalRuns) : "—"} sub="Logged runs" />
      </section>

      {notice && <p className="form-notice" style={{ marginTop: 8 }}>{notice}</p>}
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

      {/* --- Approval queue --- */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <h3>Pending approval</h3>
          <small>{pending.length} waiting</small>
        </div>

        {loading ? (
          <Spinner label="Loading…" />
        ) : pending.length === 0 ? (
          <p className="state-msg" style={{ marginTop: 0 }}>Nothing waiting — the queue is clear. 🎉</p>
        ) : (
          <ul className="roster-list">
            {pending.map((a) => (
              <li key={a.id} style={{ alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{a.title}</strong>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {a.eventKind === "VOLUNTEER" ? "Volunteer" : "Run"} ·{" "}
                    {formatWhen(a.startsAt)}{a.location ? ` · ${a.location}` : ""} · cap {a.capacity}
                  </small>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    Submitted by <code>{a.ownerId.slice(0, 8)}…</code>
                  </small>
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                  <button className="btn btn-primary" disabled={busyId === a.id}
                    onClick={() => moderate(a, true)}>
                    <Icon name="leaf" size={14} /> Approve
                  </button>
                  <button className="btn btn-danger" disabled={busyId === a.id}
                    onClick={() => moderate(a, false)}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- User management --- */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <h3>Users</h3>
          <small>{users.length} total</small>
        </div>

        {loading ? (
          <Spinner label="Loading…" />
        ) : users.length === 0 ? (
          <p className="state-msg" style={{ marginTop: 0 }}>No users yet.</p>
        ) : (
          <ul className="roster-list">
            {users.map((u) => {
              const needsVerify = !u.verified && (u.role === "ACTIVITY_MANAGER" || u.role === "PARTNER");
              const isSelf = u.userId === user?.userId;
              const isSysadmin = u.role === "SYSADMIN"; // protected — can't be suspended
              return (
                <li key={u.userId} style={{ alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{u.fullName || u.email}</strong>
                    <small style={{ display: "block", color: "var(--muted)" }}>
                      {u.email} · {u.role.replace(/_/g, " ")}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "none" }}>
                    {u.suspended && <span className="pill warn">Suspended</span>}
                    {needsVerify && <span className="pill warn">Unverified</span>}
                    {u.verified && !u.suspended && <span className="pill">Active</span>}

                    {needsVerify && (
                      <button className="btn btn-primary" disabled={busyId === u.userId}
                        onClick={() => userAction(u, () => verifyUser(u.userId), `Verified ${u.email}.`)}>
                        Verify
                      </button>
                    )}
                    {!isSelf && (u.suspended ? (
                      <button className="btn btn-secondary" disabled={busyId === u.userId}
                        onClick={() => userAction(u, () => unsuspendUser(u.userId), `Unsuspended ${u.email}.`)}>
                        Unsuspend
                      </button>
                    ) : !isSysadmin ? (
                      <button className="btn btn-danger" disabled={busyId === u.userId}
                        onClick={() => userAction(u, () => suspendUser(u.userId), `Suspended ${u.email}.`)}>
                        Suspend
                      </button>
                    ) : null)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="stat-card">
      <div className="icon"><Icon name={icon} size={18} /></div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
