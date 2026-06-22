// src/pages/ClanPage.tsx
// The "Clan" tab: your clan (join / leave / create), the directory of all
// clans, and the live leaderboard. Clan management used to be buried in the
// Profile page — it lives here now so clans are a first-class destination.
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { listClans, joinClan, leaveClan, createClan, type Clan } from "../api/clans";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { ClanRankingSection } from "../components/ClanRankingSection";

export function ClanPage() {
  const { profile, refreshProfile } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", tag: "", color: "#00B86B" });
  const [showCreate, setShowCreate] = useState(false);

  async function reloadClans() {
    try {
      setClans(await listClans());
    } catch {
      /* non-fatal — the leaderboard still renders */
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listClans();
        if (!cancelled) setClans(items);
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

  const myClanId = profile?.clan?.id ?? null;

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Clan</h1>
          <div className="sub">Your team, the directory, and the live ranking</div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* --- Your clan --- */}
      <div className="card">
        <div className="card-title">
          <h3>Your clan</h3>
          {!myClanId && (
            <button className="btn btn-secondary" onClick={() => setShowCreate((s) => !s)}>
              <Icon name="plus" size={14} /> Create a clan
            </button>
          )}
        </div>

        {myClanId && profile?.clan ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="clan-tag-pill" style={{ marginTop: 0 }}>
              <span className="dot" style={{ background: profile.clan.color }} />
              {profile.clan.name} · {profile.clan.tag}
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

      {/* --- Live leaderboard --- */}
      <div style={{ marginTop: 24 }}>
        <ClanRankingSection myClanId={myClanId} />
      </div>
    </Shell>
  );
}
