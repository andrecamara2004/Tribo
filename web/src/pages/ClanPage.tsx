// src/pages/ClanPage.tsx
// The "Clan" tab — inspired by Clash Royale:
//   • If the user is in a clan → opens directly on the Chat tab.
//   • "Top Clans" tab shows the existing leaderboard + directory.
//   • Polling every 5 s keeps the chat fresh without WebSockets.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  listClans, joinClan, leaveClan, createClan,
  getClanMessages, sendClanMessage, getClanMembers,
  type Clan, type ClanMessage, type ClanMember,
} from "../api/clans";
import { ApiError } from "../api/http";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { ClanRankingSection } from "../components/ClanRankingSection";

type Tab = "chat" | "clans" | "ranking";

// --- helpers -----------------------------------------------------------------

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// --- ClanChat component ------------------------------------------------------

function ClanChat({ clanId, myClanName, myClanColor }: {
  clanId: string;
  myClanName: string;
  myClanColor: string;
}) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await getClanMessages(clanId);
        setMessages(msgs);
      } catch { /* non-fatal */ }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(load, 5000); // poll every 5 s
    return () => clearInterval(interval);
  }, [clanId]);

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendClanMessage(clanId, trimmed);
      setMessages((prev) => [...prev, msg]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  // Group messages by date for date dividers.
  const grouped: { date: string; messages: ClanMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.sentAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ date, messages: [msg] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 400 }}>
      {/* Chat header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 10, background: myClanColor,
          color: "#fff", fontWeight: 800, fontSize: 13, flex: "none",
        }}>
          {profile?.clan?.tag ?? "?"}
        </span>
        <div>
          <strong style={{ fontSize: 15 }}>{myClanName}</strong>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Clan Chat</div>
        </div>
      </div>

      {/* Messages list */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 4,
        background: "var(--bg)",
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", marginTop: 40, fontSize: 14 }}>
            No messages yet. Say hello! 👋
          </div>
        )}

        {grouped.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            {/* Date divider */}
            <div style={{
              textAlign: "center", fontSize: 11, color: "var(--muted)",
              margin: "12px 0 8px", letterSpacing: "0.5px",
            }}>
              {date}
            </div>
            {dayMsgs.map((msg) => {
              const isMe = msg.userId === profile?.userId;
              return (
                <div key={msg.id} style={{
                  display: "flex",
                  flexDirection: isMe ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 8, marginBottom: 6,
                }}>
                  {/* Avatar */}
                  {!isMe && (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: myClanColor, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 11, flex: "none",
                    }}>
                      {msg.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ maxWidth: "72%" }}>
                    {!isMe && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2, paddingLeft: 4 }}>
                        {msg.fullName}
                      </div>
                    )}
                    <div style={{
                      padding: "8px 12px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMe ? "#00B86B" : "#1f2937",
                      color: "#fff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                      fontSize: 14, lineHeight: 1.4,
                    }}>
                      {msg.text}
                    </div>
                    <div style={{
                      fontSize: 10, color: "var(--muted)", marginTop: 2,
                      textAlign: isMe ? "right" : "left", paddingLeft: 4, paddingRight: 4,
                    }}>
                      {formatTime(msg.sentAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={onSend} style={{
        display: "flex", gap: 8, padding: "12px 16px",
        borderTop: "1px solid var(--line)", background: "var(--surface)",
      }}>
        {error && (
          <div style={{ fontSize: 12, color: "var(--danger)", padding: "4px 0", flex: "0 0 100%" }}>
            {error}
          </div>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your clan…"
          maxLength={500}
          style={{ flex: 1 }}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(e as unknown as FormEvent);
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// --- ClanInfoModal component ---------------------------------------------------

function ClanInfoModal({
  clanId, clanName, clanTag, clanColor, onClose,
}: {
  clanId: string; clanName: string; clanTag: string; clanColor: string; onClose: () => void;
}) {
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getClanMembers(clanId).then((res) => {
      if (!cancelled) { setMembers(res); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clanId]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", width: 320, maxHeight: "70vh", height: 600,
        borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 20, background: clanColor, color: "#fff", flex: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{clanName}</h2>
              <div style={{ opacity: 0.9, fontSize: 13, marginTop: 4 }}>{clanTag}</div>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(0,0,0,0.2)", border: "none", color: "#fff",
              width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--bg)", flex: "none" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            Members: <span style={{ color: "var(--ink)" }}>{members.length}</span> / 50
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", background: "var(--bg)" }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Loading members...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No members found.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {members.map(m => (
                <li key={m.id} style={{
                  padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: clanColor,
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14,
                  }}>
                    {m.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{m.fullName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>
                      {m.role.toLowerCase()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// --- ClanPage (main component) -----------------------------------------------

export function ClanPage() {
  const { profile, refreshProfile } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", tag: "", color: "#00B86B" });
  const [showCreate, setShowCreate] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedClanInfo, setSelectedClanInfo] = useState<{ id: string; name: string; tag: string; color: string; } | null>(null);

  const myClanId = profile?.clan?.id ?? null;
  const [tab, setTab] = useState<Tab>(myClanId ? "chat" : "clans");

  const filteredClans = clans.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Keep tab in sync if the user joins/leaves a clan.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(myClanId ? "chat" : "clans");
  }, [myClanId]);

  async function reloadClans() {
    try { setClans(await listClans()); } catch { /* non-fatal */ }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listClans();
        if (!cancelled) setClans(items);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
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
      setTimeout(() => setError(null), 5000);
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

  const tabs: { key: Tab; label: string; icon: string; disabled?: boolean }[] = [
    { key: "chat", label: "Chat", icon: "🗪", disabled: !myClanId },
    { key: "clans", label: "Clans", icon: "🛡️" },
    { key: "ranking", label: "Ranking", icon: "🏆" },
  ];

  return (
    <Shell>
      {/* Page header + tab bar */}
      <div className="topbar">
        <div>
          <h1>Clan</h1>
          <div className="sub">Your team chat and the live ranking</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--line)", borderRadius: 10, padding: 4 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={tab === t.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, opacity: t.disabled ? 0.4 : 1 }}
              onClick={() => !t.disabled && setTab(t.key)}
              disabled={t.disabled}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* ── Chat tab ── */}
      {tab === "chat" && myClanId && profile?.clan && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <ClanChat
            clanId={myClanId}
            myClanName={profile.clan.name}
            myClanColor={profile.clan.color}
          />
        </div>
      )}

      {/* ── Clans tab ── */}
      {tab === "clans" && (
        <>
          {/* Your clan */}
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
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => setShowLeaveConfirm(true)}
                >
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

          {/* Global Search */}
          <div style={{ position: "relative", marginTop: 16 }}>
            <input
              type="text"
              placeholder="Search clans by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 12,
                border: "1px solid var(--line)", background: "var(--card)",
                fontSize: 15, boxShadow: "var(--shadow)"
              }}
            />
            {searchQuery && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                marginTop: 4, background: "var(--card)", borderRadius: 12,
                boxShadow: "var(--shadow-lg)", overflow: "hidden", zIndex: 10,
                maxHeight: 240, overflowY: "auto"
              }}>
                {filteredClans.length === 0 ? (
                  <div style={{ padding: "12px 16px", color: "var(--muted)" }}>No clans found.</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredClans.map(c => (
                      <li key={c.id} onClick={() => {
                        setSelectedClanInfo({ id: c.id, name: c.name, tag: c.tag, color: c.color });
                        setSearchQuery("");
                      }} style={{
                        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                        cursor: "pointer", borderBottom: "1px solid var(--line)"
                      }}>
                        <span className="clan-tag" style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: 6, color: "#fff", fontWeight: 800,
                          fontSize: 10, background: c.color, flex: "none",
                        }}>{c.tag}</span>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* All clans */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">
              <h3 style={{ margin: 0 }}>All clans</h3>
              <small>{clans.length} active</small>
            </div>
            {clans.length === 0 ? (
              <p className="state-msg" style={{ marginTop: 0 }}>
                No clans yet — be the first to create one.
              </p>
            ) : (
              <ul className="roster-list">
                {clans.map((c) => (
                  <li key={c.id} onClick={() => setSelectedClanInfo({ id: c.id, name: c.name, tag: c.tag, color: c.color })} style={{ cursor: "pointer" }}>
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
                        <button className="btn btn-secondary" disabled={busy} onClick={(e) => { e.stopPropagation(); act(() => joinClan(c.id)); }}>
                          Join
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── Ranking tab ── */}
      {tab === "ranking" && (
        <div style={{ marginTop: 8 }}>
          <ClanRankingSection myClanId={myClanId} onClanClick={(id, name, tag, color) => setSelectedClanInfo({ id, name, tag, color })} />
        </div>
      )}

      {selectedClanInfo && (
        <ClanInfoModal
          clanId={selectedClanInfo.id}
          clanName={selectedClanInfo.name}
          clanTag={selectedClanInfo.tag}
          clanColor={selectedClanInfo.color}
          onClose={() => setSelectedClanInfo(null)}
        />
      )}

      {showLeaveConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setShowLeaveConfirm(false)}>
          <div style={{
            background: "var(--card)", width: 320, padding: "24px",
            borderRadius: 16, display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "var(--shadow-lg)", textAlign: "center"
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, color: "var(--ink)" }}>Leave Clan?</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              Are you sure you want to leave your clan? You will lose access to the clan chat.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowLeaveConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => {
                setShowLeaveConfirm(false);
                act(leaveClan);
              }}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

