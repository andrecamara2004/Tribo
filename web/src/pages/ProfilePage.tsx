// src/pages/ProfilePage.tsx
// Sprint 3 Phase 1: real profile header from GET /users/me + running/volunteer
// stats. Clan management (join / leave / create) now lives on the dedicated
// Clan tab — the header still shows which clan you're in.
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getMyStats, type RunStats } from "../api/runs";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { formatPace } from "../lib/run";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ProfilePage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<RunStats | null>(null);

  // Initial load — await before setState (avoids the set-state-in-effect rule),
  // with a cancel guard, mirroring ActivitiesPage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getMyStats();
        if (!cancelled) setStats(s);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) {
    return (
      <Shell>
        <p className="state-msg">Loading profile…</p>
      </Shell>
    );
  }

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

      {/* --- Stats: real running data (Phase 2); volunteer impact (Phase 3) --- */}
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
        <div className="card">
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
