// src/pages/TrackerPage.tsx
// Sprint 3 Phase 2: the "Last run" screen wired to real data. Shows the caller's
// most recent run (phone mockup + per-km splits) and a manual log-run form —
// mobile GPS logging isn't built yet, so the form lets you post a finished run
// (D-4) from the web to see the feature end-to-end.
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { getLastRun, getMyStats, logRun, type Run, type RunStats } from "../api/runs";
import { setWeeklyGoal } from "../api/users";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { RouteMap } from "../components/RouteMap";
import { Icon } from "../components/Icon";
import { formatPace, formatDuration, km, paceSecPerKm } from "../lib/run";
import { formatWhen } from "../lib/activity";

const ROUTE_TYPES = ["river", "trail", "park", "coast", "city"];

const emptyForm = {
  title: "", location: "", distanceKm: "", durationMin: "", durationSec: "",
  elevation: "0", routeType: "river",
};

export function TrackerPage() {
  const { profile, refreshProfile } = useAuth();
  const [last, setLast] = useState<Run | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);

  async function saveGoal(e: FormEvent) {
    e.preventDefault();
    setGoalBusy(true);
    try {
      await setWeeklyGoal(Math.max(0, Number(goalInput) || 0));
      await refreshProfile();
      setGoalEditing(false);
    } catch {
      /* ignore — non-critical */
    } finally {
      setGoalBusy(false);
    }
  }

  // Initial load — await before setState (avoids set-state-in-effect), with a
  // cancel guard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [l, s] = await Promise.all([getLastRun(), getMyStats()]);
        if (!cancelled) {
          setLast(l);
          setStats(s);
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onLog(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const distanceMeters = Math.round(Number(form.distanceKm) * 1000);
    const durationSeconds = Number(form.durationMin || 0) * 60 + Number(form.durationSec || 0);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return setError("Distance must be greater than 0.");
    if (durationSeconds <= 0) return setError("Duration must be greater than 0.");

    setBusy(true);
    try {
      await logRun({
        title: form.title.trim() || "Run",
        location: form.location.trim(),
        distanceMeters,
        durationSeconds,
        elevationMeters: Math.max(0, Number(form.elevation) || 0),
        routeType: form.routeType,
        startedAt: new Date().toISOString(),
      });
      const [l, s] = await Promise.all([getLastRun(), getMyStats()]);
      setLast(l);
      setStats(s);
      setForm({ ...emptyForm });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log run.");
    } finally {
      setBusy(false);
    }
  }

  const fastest = last && last.splits.length
    ? Math.min(...last.splits.map((s) => s.durationSeconds))
    : 0;
  const barWidth = (sec: number) =>
    `${Math.min(100, 60 + (1 - (sec - fastest) / 30) * 40)}%`;

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Last run</h1>
          <div className="sub">Synced runs from your account · live tracking happens in the mobile app</div>
        </div>
        <div className="right">
          {stats && stats.streak > 0 && (
            <span className="pill"><Icon name="flame" size={12} /> {stats.streak}-day streak</span>
          )}
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            <Icon name="plus" size={16} /> Log a run
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showForm && (
        <form className="card" onSubmit={onLog} style={{ marginBottom: 20 }}>
          <div className="card-title"><h3>Log a finished run</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Title</label>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Morning run" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Location</label>
              <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Belém, Lisboa" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Distance (km)</label>
              <input type="number" step="0.1" min="0" value={form.distanceKm}
                onChange={(e) => set("distanceKm", e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Duration (min : sec)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" min="0" value={form.durationMin} placeholder="min"
                  onChange={(e) => set("durationMin", e.target.value)} required />
                <input type="number" min="0" max="59" value={form.durationSec} placeholder="sec"
                  onChange={(e) => set("durationSec", e.target.value)} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Elevation (m)</label>
              <input type="number" min="0" value={form.elevation} onChange={(e) => set("elevation", e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Route type</label>
              <select value={form.routeType} onChange={(e) => set("routeType", e.target.value)}>
                {ROUTE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save run"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : !last ? (
        <div className="card">
          <p className="state-msg" style={{ marginTop: 0 }}>
            No runs yet. Log one above to see your last run, splits, and stats here.
          </p>
        </div>
      ) : (
        <div className="tracker-layout">
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-screen">
              <span className="live-pill past">
                <span className="dot" /> Last run · {formatWhen(last.startedAt)}
                {last.location ? ` · ${last.location}` : ""}
              </span>

              <div className="big-metric">
                <div className="label">Distance</div>
                <div className="value">{km(last)}<em>km</em></div>
              </div>

              <div className="tile-row">
                <div className="tile">
                  <div className="label">Pace</div>
                  <div className="value">{formatPace(paceSecPerKm(last))}<small> /km</small></div>
                </div>
                <div className="tile">
                  <div className="label">Time</div>
                  <div className="value">{formatDuration(last.durationSeconds)}</div>
                </div>
              </div>

              <div className="tracker-map"><RouteMap variant={last.routeType} /></div>

              <div className="tracker-controls">
                <button className="btn-pause">{last.elevationMeters} m elev</button>
                <button className="btn-stop" onClick={() => setShowForm(true)}>Log another</button>
              </div>
            </div>
          </div>

          <div className="tracker-side">
            <h3>{last.title}</h3>
            <h3 style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Splits · per kilometer</h3>
            {last.splits.length === 0 ? (
              <div className="card">
                <p className="state-msg" style={{ margin: 0 }}>
                  No per-km splits recorded for this run.
                </p>
              </div>
            ) : (
              <div className="splits">
                <div className="splits-row head"><span>Km</span><span>Pace</span><span>Δ</span></div>
                {last.splits.map((s) => {
                  const delta = s.durationSeconds - fastest;
                  return (
                    <div key={s.km} className="splits-row">
                      <span style={{ fontWeight: 700 }}>{s.km}</span>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600 }}>{formatPace(s.durationSeconds)}<small style={{ color: "var(--muted)", fontWeight: 500 }}> /km</small></span>
                        </div>
                        <div className="split-bar"><span style={{ width: barWidth(s.durationSeconds) }} /></div>
                      </div>
                      <span style={{ color: delta === 0 ? "var(--green-600)" : "var(--muted)", fontWeight: delta === 0 ? 700 : 500 }}>
                        {delta === 0 ? "fastest" : `+${delta}s`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {stats && (() => {
              const weekTotal = stats.weeklyKm.reduce((a, b) => a + b, 0);
              const goal = profile?.weeklyGoalKm ?? 0;
              const pct = goal > 0 ? Math.min(100, (weekTotal / goal) * 100) : 0;
              return (
                <div className="card" style={{ marginTop: 20 }}>
                  <div className="card-title">
                    <h3>Weekly goal</h3>
                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => { setGoalInput(goal ? String(goal) : ""); setGoalEditing((v) => !v); }}>
                      {goal > 0 ? "Edit" : "Set goal"}
                    </button>
                  </div>

                  {goalEditing ? (
                    <form onSubmit={saveGoal} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input type="number" step="0.5" min="0" value={goalInput} placeholder="km / week"
                        onChange={(e) => setGoalInput(e.target.value)}
                        style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10 }} />
                      <button type="submit" className="btn btn-primary" disabled={goalBusy} style={{ padding: "8px 14px" }}>
                        {goalBusy ? "…" : "Save"}
                      </button>
                    </form>
                  ) : goal > 0 ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <strong>{weekTotal.toFixed(1)} / {goal.toFixed(1)} km</strong>
                        <span className="pill">{Math.round(pct)}%</span>
                      </div>
                      <div className="progress-bar"><span style={{ width: `${pct}%` }} /></div>
                    </>
                  ) : (
                    <p className="state-msg" style={{ margin: "0 0 8px" }}>
                      No weekly goal set — {weekTotal.toFixed(1)} km logged this week.
                    </p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
                    <span>{stats.monthRuns} runs this month · {stats.monthKm.toFixed(1)} km</span>
                    <span>avg {formatPace(stats.avgPaceSecPerKm)}/km</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </Shell>
  );
}
