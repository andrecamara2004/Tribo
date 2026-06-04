// src/pages/ProfilePage.tsx
// Sprint 3 Phase 1: real profile header from GET /users/me + clan management
// (join / leave / create). Running stats are placeholders until Phase 2 (runs).
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { listClans, joinClan, leaveClan, createClan, type Clan } from "../api/clans";
import { getMyStats, type RunStats } from "../api/runs";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { formatPace } from "../lib/run";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", tag: "", color: "#00B86B" });
  const [showCreate, setShowCreate] = useState(false);

  async function reloadClans() {
    try {
      setClans(await listClans());
    } catch {
      /* non-fatal — the header still works without the clan list */
    }
  }

  // Initial load — await before setState (avoids the set-state-in-effect rule),
  // with a cancel guard, mirroring ActivitiesPage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [items, s] = await Promise.all([listClans(), getMyStats()]);
        if (!cancelled) {
          setClans(items);
          setStats(s);
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refreshProfile();
      await reloadClans();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await createClan({ name: form.name.trim(), tag: form.tag.trim().toUpperCase(), color: form.color });
      setShowCreate(false);
      setForm({ name: "", tag: "", color: "#00B86B" });
    });
  }

  if (!profile) {
    return (
      <Shell>
        <p className="state-msg">Loading profile…</p>
      </Shell>
    );
  }

  const myClanId = profile.clan?.id ?? null;

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Profile</h1>
          <div className="sub">Your identity, clan, and impact</div>
        </div>
      </div>

      <section className="profile-head">
        <Avatar name={profile.fullName} color={profile.avatarColor} size="xl" />
        <div className="who">
          <h2>{profile.fullName}</h2>
          <div className="handle">{profile.handle}</div>
          {profile.clan ? (
            <span className="clan-tag-pill">
              <span className="dot" style={{ background: profile.clan.color }} />
              {profile.clan.name} · {profile.clan.tag}
            </span>
          ) : (
            <span className="clan-tag-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>
              No clan yet
            </span>
          )}
          <span className="pill partner" style={{ marginLeft: 8 }}>
            {user?.role.replace(/_/g, " ")}
          </span>
          {user?.verified === false && (
            <span className="pill warn" style={{ marginLeft: 8 }}>Pending verification</span>
          )}
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      {/* --- Stats: real running data (Phase 2); Volunteer lands in Phase 3 --- */}
      <section className="stats-grid">
        <StatCard icon="ruler" label="This month"
          value={stats ? `${stats.monthKm.toFixed(1)} km` : "—"}
          sub={stats ? `${stats.monthRuns} run${stats.monthRuns === 1 ? "" : "s"}` : "Loading…"} />
        <StatCard icon="flame" label="Streak"
          value={stats ? `${stats.streak} day${stats.streak === 1 ? "" : "s"}` : "—"}
          sub="Consecutive run days" />
        <StatCard icon="trophy" label="Avg pace"
          value={stats ? `${formatPace(stats.avgPaceSecPerKm)}/km` : "—"}
          sub="All-time" />
        <StatCard icon="leaf" label="Volunteer"
          value={`${profile.volunteerPoints} pts`}
          sub={`${profile.volunteerEvents} event${profile.volunteerEvents === 1 ? "" : "s"} · ${profile.staffEligible ? "staff-eligible" : `${Math.max(0, 3 - profile.volunteerEvents)} more for staff`}`} />
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">
          <h3>Achievements</h3>
          <small>{profile.achievements.length} earned</small>
        </div>
        {profile.achievements.length === 0 ? (
          <p className="state-msg" style={{ margin: 0 }}>Run and volunteer to earn badges.</p>
        ) : (
          <div className="achievements">
            {profile.achievements.map((a, i) => (
              <div key={i} className="achievement">
                <div className="ico">{a.icon}</div>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.sub}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <h3>Weekly distance</h3>
            <small>{stats.weeklyKm.reduce((a, b) => a + b, 0).toFixed(1)} km this week</small>
          </div>
          <div className="bars-lg">
            {stats.weeklyKm.map((v, i) => {
              const max = Math.max(...stats.weeklyKm, 1);
              return (
                <div key={i} className="bar-wrap">
                  <div className={"bar " + (v === 0 ? "empty" : "")} style={{ height: `${(v / max) * 100}%` }}>
                    {v > 0 && <span className="km">{v.toFixed(1)}</span>}
                  </div>
                  <span className="day">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Clan management (real) --- */}
      <div className="card">
        <div className="card-title">
          <h3>Your clan</h3>
          {!myClanId && (
            <button className="btn btn-secondary" onClick={() => setShowCreate((s) => !s)}>
              <Icon name="plus" size={14} /> Create a clan
            </button>
          )}
        </div>

        {myClanId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="clan-tag-pill" style={{ marginTop: 0 }}>
              <span className="dot" style={{ background: profile.clan!.color }} />
              {profile.clan!.name} · {profile.clan!.tag}
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn btn-danger" disabled={busy} onClick={() => act(leaveClan)}>
              Leave clan
            </button>
          </div>
        ) : (
          <p className="state-msg" style={{ marginTop: 0 }}>
            You're not in a clan yet. Join one below or create your own.
          </p>
        )}

        {showCreate && !myClanId && (
          <form onSubmit={onCreate} style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 2, minWidth: 180, marginBottom: 0 }}>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 90, marginBottom: 0 }}>
                <label>Tag</label>
                <input value={form.tag} maxLength={5} placeholder="FOR"
                  onChange={(e) => setForm({ ...form, tag: e.target.value })} required />
              </div>
              <div className="field" style={{ width: 64, marginBottom: 0 }}>
                <label>Color</label>
                <input type="color" value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  style={{ padding: 4, height: 44 }} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: "flex-end" }}>
                Create
              </button>
            </div>
          </form>
        )}
      </div>

      {/* --- Discover clans --- */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <h3>All clans</h3>
          <small>{clans.length} active</small>
        </div>
        {clans.length === 0 ? (
          <p className="state-msg" style={{ marginTop: 0 }}>No clans yet — be the first to create one.</p>
        ) : (
          <ul className="roster-list">
            {clans.map((c) => (
              <li key={c.id}>
                <span className="clan-tag" style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 8, color: "#fff", fontWeight: 800,
                  fontSize: 11, background: c.color, flex: "none",
                }}>{c.tag}</span>
                <div>
                  <strong style={{ fontSize: 14 }}>{c.name}</strong>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                  </small>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  {c.id === myClanId ? (
                    <span className="pill">You're in</span>
                  ) : (
                    <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => joinClan(c.id))}>
                      Join
                    </button>
                  )}
                </span>
              </li>
            ))}
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

