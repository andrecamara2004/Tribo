/* ============================================================
   Tribo · React app · single-file JSX
   Loaded via Babel-standalone for the prototype (no build step).
   ============================================================ */

const { useState, useEffect, useMemo } = React;

/* -----------------------------------------------------------
   Icons — inline SVG, same stroke style for visual cohesion
   ----------------------------------------------------------- */
const ICONS = {
  home:    <><path d="M3 11.5 12 3l9 8.5"/><path d="M5 10v11h14V10"/></>,
  run:     <><circle cx="14" cy="5" r="2"/><path d="M4 21l4-5 3 1 4-3 4 3"/><path d="M9 13l3-3 3 3-3 4"/></>,
  trophy:  <><path d="M8 21h8M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3"/></>,
  leaf:    <><path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 13-9-2 7-4 12-13 16"/><path d="M2 22c2-3 5-5 13-9"/></>,
  user:    <><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></>,
  bell:    <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  search:  <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
  heart:   <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></>,
  comment: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  share:   <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></>,
  pin:     <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  clock:   <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  flame:   <><path d="M12 2c1 4-2 6-2 9a4 4 0 0 0 8 0c0-2-1-3-2-5 0 2-2 3-2 1 0-2 0-3-2-5z"/></>,
  trash:   <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></>,
  bag:     <><path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></>,
  zap:     <><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  logout:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>,
  plus:    <><path d="M12 5v14M5 12h14"/></>,
  ruler:   <><path d="M3 12l9-9 9 9-9 9z"/><path d="M7 13l1.5 1.5M10 10l1.5 1.5M13 7l1.5 1.5"/></>,
};
const Icon = ({ name, size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}
       fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

/* -----------------------------------------------------------
   Helpers
   ----------------------------------------------------------- */
const fetchJson = async (url, fallback) => {
  try { const r = await fetch(url); if (r.ok) return await r.json(); }
  catch (_) { /* fall through */ }
  return fallback;
};

const Avatar = ({ name = "??", color = "#00B86B", size = "" }) => {
  const initials = name.split(/\s+/).map(s => s[0]).join("").slice(0,2).toUpperCase();
  return <div className={"avatar " + size} style={{ background: color }}>{initials}</div>;
};

const RouteMap = ({ variant = "river" }) => {
  const paths = {
    river: "M5 75 Q40 30 80 50 T140 35 T195 22",
    trail: "M10 80 Q30 40 55 60 Q80 80 100 45 Q125 18 150 40 Q180 65 195 28",
    park:  "M8 80 Q40 50 70 65 T130 55 T195 38",
    coast: "M5 82 Q60 55 100 65 Q140 78 195 28",
    city:  "M10 82 L42 82 L42 50 L82 50 L82 72 L122 72 L122 30 L195 30",
  };
  const id = `bg-${variant}-${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg viewBox="0 0 200 90" preserveAspectRatio="none" width="100%" height="100%">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#E8F7EF"/>
          <stop offset="100%" stopColor="#D5F0E1"/>
        </linearGradient>
      </defs>
      <rect width="200" height="90" fill={`url(#${id})`}/>
      <path d={paths[variant] || paths.river} stroke="#00B86B" strokeWidth="3"
            fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="195" cy={paths[variant]?.match(/(\d+)\s*$/)?.[1] || 22} r="3.5" fill="#008F4F"/>
    </svg>
  );
};

/* -----------------------------------------------------------
   LOGIN
   ----------------------------------------------------------- */
function Login({ onSignIn }) {
  return (
    <div className="login">
      <aside className="login-art">
        <div className="login-logo">
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="36" height="36"/>
          <span>Tribo</span>
        </div>

        <div>
          <h1>Run together.<br/>Compete together.<br/>Make impact.</h1>
          <p>Form a clan. Climb the rankings. Clean up your city.<br/>
             A runner's app for people who don't run alone.</p>
        </div>

        <div className="login-quote">
          "We jumped from 4th to 1st in two weeks just because the team
           knew the average pace was on the line."
          <strong>— Forest Runners, currently #1</strong>
        </div>
      </aside>

      <section className="login-form">
        <h2>Welcome back</h2>
        <p className="subtitle">Sign in to your Tribo account</p>

        <div className="field">
          <label>Email</label>
          <input type="email" defaultValue="ana.costa@tribo.run" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" defaultValue="••••••••••••" />
        </div>

        <button className="btn btn-primary" onClick={onSignIn}>Sign in</button>

        <div className="divider">or</div>

        <button className="btn btn-secondary">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4a12 12 0 0 1-11.3-8L6.2 33A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z"/></svg>
          Continue with Google
        </button>

        <p className="login-footer">
          New to Tribo? <a>Create your clan →</a>
        </p>
      </section>
    </div>
  );
}

/* -----------------------------------------------------------
   FEED
   ----------------------------------------------------------- */
function FeedCard({ item }) {
  const isVol = item.type === "volunteer";
  return (
    <article className="feed-card">
      <div className="feed-head">
        <Avatar name={item.user.name} color={item.user.color} />
        <div className="who">
          <strong>{item.user.name}</strong>
          <small>{item.user.clan} · {item.when} · {item.location}</small>
        </div>
        {isVol
          ? <span className="pill">🌱 Volunteer · {item.role === "staff" ? "staff" : "runner"}</span>
          : <span className="pill gray">Run</span>}
      </div>

      <h3 className="feed-title">{item.title}</h3>

      <div className="feed-stats">
        <div className="metric">
          <span className="label">Distance</span>
          <span className="value">{item.distanceKm}<small>km</small></span>
        </div>
        <div className="metric">
          <span className="label">Pace</span>
          <span className="value">{item.pace}<small>/km</small></span>
        </div>
        <div className="metric">
          <span className="label">Time</span>
          <span className="value">{item.duration}</span>
        </div>
        <div className="metric">
          <span className="label">{isVol ? "Points" : "Elev"}</span>
          <span className="value">
            {isVol ? `+${item.pointsEarned}` : item.elevationM}
            <small>{isVol ? "pts" : "m"}</small>
          </span>
        </div>
      </div>

      <div className="feed-map"><RouteMap variant={item.route}/></div>

      <div className="feed-actions">
        <button><Icon name="heart" size={16}/> {item.kudos}</button>
        <button><Icon name="comment" size={16}/> {item.comments}</button>
        <button><Icon name="share" size={16}/> Share</button>
        <span className="spacer" />
        {isVol && <span className="pill">✓ Verified by event staff</span>}
      </div>
    </article>
  );
}

function Feed({ profile }) {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("All");
  useEffect(() => { fetchJson("/api/feed", []).then(setItems); }, []);

  const filtered = items.filter(i => {
    if (tab === "All") return true;
    if (tab === "My clan") return i.user.clan === (profile?.clan?.name || "Forest Runners");
    if (tab === "Volunteer") return i.type === "volunteer";
    return true;
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Activity feed</h1>
          <div className="sub">What your clan and friends ran today</div>
        </div>
        <div className="right">
          <div className="tabs">
            {["All","My clan","Volunteer"].map(t =>
              <button key={t} className={t===tab?"active":""} onClick={() => setTab(t)}>{t}</button>
            )}
          </div>
          <button className="icon-btn"><Icon name="bell" size={18}/></button>
        </div>
      </div>

      <div className="feed-layout">
        <div className="feed-list">
          {filtered.map(it => <FeedCard key={it.id} item={it}/>)}
        </div>

        <aside className="feed-side">
          <YourWeekCard profile={profile}/>
          <TopClanMiniCard/>
          <UpcomingMiniCard/>
        </aside>
      </div>
    </>
  );
}

function YourWeekCard({ profile }) {
  const week = profile?.weeklyKm || [6.2, 0, 8.4, 5.1, 12.0, 4.5, 10.3];
  const max = Math.max(...week, 1);
  const days = ["M","T","W","T","F","S","S"];
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">
        <h3>Your week</h3>
        <small>{week.reduce((a,b)=>a+b,0).toFixed(1)} km</small>
      </div>
      <div className="bars">
        {week.map((v,i) =>
          <div key={i}
               className={"bar " + (v === 0 ? "muted" : "")}
               style={{ height: `${Math.max(8, (v/max)*100)}%` }}/>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)", marginTop:8, fontWeight:600 }}>
        {days.map((d,i) => <span key={i}>{d}</span>)}
      </div>
    </div>
  );
}

function TopClanMiniCard() {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">
        <h3>Clan leaderboard</h3>
        <small>Avg pace</small>
      </div>
      {[
        { rk: 1, name: "Forest Runners",   pace: "4:42", c:"#00B86B", mine:true },
        { rk: 2, name: "Trash Hunters",    pace: "5:01", c:"#3A7BD5" },
        { rk: 3, name: "Sunday Striders",  pace: "4:55", c:"#FFB020" },
      ].map(c =>
        <div key={c.name}
             style={{
               display:"flex", alignItems:"center", gap:12,
               padding:"10px 0", borderTop:"1px solid var(--line)",
               fontWeight: c.mine ? 700 : 500
             }}>
          <span style={{ width:18, color:"var(--muted)", fontWeight:800, fontSize:13 }}>{c.rk}</span>
          <span style={{ width:8, height:8, borderRadius:"50%", background:c.c }}/>
          <span style={{ flex:1, fontSize:13 }}>{c.name}{c.mine && <span className="pill" style={{ marginLeft:8, fontSize:10 }}>You</span>}</span>
          <span style={{ fontWeight:700, fontSize:14 }}>{c.pace}</span>
        </div>
      )}
    </div>
  );
}

function UpcomingMiniCard() {
  return (
    <div className="card">
      <div className="card-title"><h3>This weekend</h3><small>Volunteer</small></div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ background:"var(--green-50)", color:"var(--green-700)", borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:12, textAlign:"center", minWidth:46 }}>SAT<br/>16</span>
          <div>
            <strong style={{ fontSize:13, display:"block" }}>Tagus Cleanup</strong>
            <small style={{ color:"var(--muted)" }}>Cais do Sodré · 7 km</small>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ background:"var(--bg)", color:"var(--ink-soft)", borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:12, textAlign:"center", minWidth:46 }}>SUN<br/>17</span>
          <div>
            <strong style={{ fontSize:13, display:"block" }}>Monsanto Sweep</strong>
            <small style={{ color:"var(--muted)" }}>Parque Florestal · 9.5 km</small>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   RUN TRACKER
   ----------------------------------------------------------- */
function Tracker() {
  const [data, setData] = useState(null);
  useEffect(() => { fetchJson("/api/run-summary", null).then(setData); }, []);

  const live = data?.live || {
    distanceKm: 5.42, duration: "26:18", pace: "4:51", currentBpm: 152,
    splits: [
      { km: 1, pace: "4:58", bpm: 144 },
      { km: 2, pace: "4:52", bpm: 149 },
      { km: 3, pace: "4:47", bpm: 153 },
      { km: 4, pace: "4:49", bpm: 155 },
      { km: 5, pace: "4:50", bpm: 156 }
    ]
  };

  const fastest = Math.min(...live.splits.map(s => paceToSec(s.pace)));
  const paceWidth = sec => `${Math.min(100, 60 + (1 - (sec - fastest)/30) * 40)}%`;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Last run</h1>
          <div className="sub">2 days ago · synced from mobile · live tracking happens in the Flutter app</div>
        </div>
        <div className="right">
          <span className="pill"><Icon name="flame" size={12}/> 9-day streak</span>
          <button className="icon-btn"><Icon name="settings" size={18}/></button>
        </div>
      </div>

      <div className="tracker-layout">
        <div className="phone">
          <div className="phone-notch"></div>
          <div className="phone-screen">
            <span className="live-pill past"><span className="dot"></span> Last run · 2 days ago · Belém riverside</span>

            <div className="big-metric">
              <div className="label">Distance</div>
              <div className="value">{live.distanceKm}<em>km</em></div>
            </div>

            <div className="tile-row">
              <div className="tile">
                <div className="label">Pace</div>
                <div className="value">{live.pace}</div>
              </div>
              <div className="tile">
                <div className="label">Time</div>
                <div className="value">{live.duration}</div>
              </div>
            </div>

            <div className="tracker-map"><RouteMap variant="river"/></div>

            <div className="tracker-controls">
              <button className="btn-pause">View on map</button>
              <button className="btn-stop">Share with clan</button>
            </div>
          </div>
        </div>

        <div className="tracker-side">
          <h3>Splits · per kilometer</h3>
          <div className="splits">
            <div className="splits-row head">
              <span>Km</span><span>Pace</span><span>Δ</span>
            </div>
            {live.splits.map(s => {
              const sec = paceToSec(s.pace);
              const delta = sec - fastest;
              return (
                <div key={s.km} className="splits-row">
                  <span style={{ fontWeight:700 }}>{s.km}</span>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                      <span style={{ fontWeight:600 }}>{s.pace}<small style={{ color:"var(--muted)", fontWeight:500 }}> /km</small></span>
                    </div>
                    <div className="split-bar"><span style={{ width: paceWidth(sec) }}/></div>
                  </div>
                  <span style={{ color: delta===0 ? "var(--green-600)" : "var(--muted)", fontWeight: delta===0?700:500 }}>
                    {delta===0 ? "fastest" : `+${delta}s`}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:24 }}>
            <h3>Goal progress</h3>
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <strong>10 km under 50:00 · weekly</strong>
                <span className="pill">5.4 / 10 km</span>
              </div>
              <div className="progress-bar"><span style={{ width: `${(live.distanceKm/10)*100}%` }}/></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginTop:8 }}>
                <span>{live.distanceKm} km logged this week</span>
                <span>4.6 km to go</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
function paceToSec(p) { const [m,s] = p.split(":").map(Number); return m*60 + s; }

/* -----------------------------------------------------------
   CLAN RANKING
   ----------------------------------------------------------- */
function Ranking({ profile }) {
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState("avgPace");
  const [period, setPeriod] = useState("all");
  useEffect(() => { fetchJson("/api/clan-ranking", null).then(setData); }, []);

  if (!data) return <div className="boot">Loading rankings…</div>;
  const myClan = profile?.clan?.name;

  const distanceOf = c =>
    period === "week"  ? c.weeklyKm
  : period === "month" ? (c.monthlyKm ?? c.totalKm)
                       : c.totalKm;

  const periodLabel =
    period === "week"  ? "this week"
  : period === "month" ? "this month"
                       : "all-time";

  const sorted = [...data.clans].sort((a,b) => {
    if (metric === "avgPace")     return paceToSec(a.avgPace) - paceToSec(b.avgPace);
    if (metric === "distance")    return distanceOf(b) - distanceOf(a);
    if (metric === "consistency") return (b.consistencyPct ?? 0) - (a.consistencyPct ?? 0);
    if (metric === "impact")      return b.volunteerPoints - a.volunteerPoints;
    return 0;
  }).map((c,i) => ({ ...c, rank: i+1 }));

  const [first, second, third] = sorted;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clan ranking</h1>
          <div className="sub">Updated {data.updatedAt} · 5 active clans · weekly reset Sun 23:59</div>
        </div>
        <div className="right">
          <div className="tabs">
            <button className={metric==="avgPace"?"active":""}     onClick={() => setMetric("avgPace")}>Avg pace</button>
            <button className={metric==="distance"?"active":""}    onClick={() => setMetric("distance")}>Distance</button>
            <button className={metric==="consistency"?"active":""} onClick={() => setMetric("consistency")}>Consistency</button>
            <button className={metric==="impact"?"active":""}      onClick={() => setMetric("impact")}>Impact</button>
          </div>
        </div>
      </div>

      <div className="period-bar">
        <span className="period-label">Period</span>
        <div className="tabs period-tabs">
          <button className={period==="all"  ?"active":""} onClick={() => setPeriod("all")}>All-time</button>
          <button className={period==="month"?"active":""} onClick={() => setPeriod("month")}>This month</button>
          <button className={period==="week" ?"active":""} onClick={() => setPeriod("week")}>This week</button>
        </div>
      </div>

      <div className="podium">
        <PodiumCard clan={second} place={2} metric={metric} period={periodLabel} distanceOf={distanceOf}/>
        <PodiumCard clan={first}  place={1} metric={metric} period={periodLabel} distanceOf={distanceOf} crown/>
        <PodiumCard clan={third}  place={3} metric={metric} period={periodLabel} distanceOf={distanceOf}/>
      </div>

      <div className="clan-table">
        <div className="clan-row head">
          <span>#</span>
          <span>Clan</span>
          <span>Avg pace</span>
          <span>Distance · {periodLabel}</span>
          <span>Impact</span>
        </div>
        {sorted.map(c => (
          <div key={c.id} className={"clan-row " + (c.name === myClan ? "mine" : "")}>
            <span className="rk">{c.rank}</span>
            <div className="clan-name">
              <span className="clan-tag" style={{ background: c.color }}>{c.tag}</span>
              <div>
                <strong>{c.name}{c.name===myClan && <span className="pill" style={{ marginLeft:8, fontSize:10 }}>You</span>}</strong>
                <small>{c.members} members · {c.consistencyPct ?? "–"}% active this week</small>
              </div>
            </div>
            <span className="num">{c.avgPace}<small>/km</small></span>
            <span className="num">{distanceOf(c).toFixed(0)}<small>km</small></span>
            <span className={"num trend " + c.trend}>
              {c.volunteerPoints.toLocaleString()}<small>pts</small> {c.trend==="up"?"↑":c.trend==="down"?"↓":"→"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function PodiumCard({ clan, place, crown, metric, period, distanceOf }) {
  if (!clan) return <div/>;
  const headline =
    metric === "distance"    ? { value: distanceOf(clan).toFixed(0), unit: "km" }
  : metric === "consistency" ? { value: clan.consistencyPct ?? 0,    unit: "%" }
  : metric === "impact"      ? { value: clan.volunteerPoints.toLocaleString(), unit: "pts" }
                             : { value: clan.avgPace, unit: "/km" };
  return (
    <div className={"podium-card " + (place===1 ? "first" : "")}>
      {crown && <div className="crown">👑</div>}
      <div className={"medal " + (place===1?"gold":place===2?"silver":"bronze")}>{place}</div>
      <div className="name">
        <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:clan.color, marginRight:6 }}/>
        {clan.name}
      </div>
      <div className="pace">{headline.value}<small style={{ fontSize:12, color:"var(--muted)", fontWeight:500, marginLeft:4 }}>{headline.unit}</small></div>
      <div className="meta">{clan.members} members · {distanceOf(clan).toFixed(0)} km {period}</div>
    </div>
  );
}

/* -----------------------------------------------------------
   VOLUNTEER
   ----------------------------------------------------------- */
function Volunteer({ profile }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All");
  useEffect(() => { fetchJson("/api/volunteer-events", []).then(setEvents); }, []);

  const filtered = events.filter(e => {
    if (filter === "All") return true;
    return e.tags?.includes(filter.toLowerCase());
  });

  const stats       = profile?.stats || {};
  const eligible    = !!stats.staffEligible;
  const eventsDone  = stats.volunteerEvents ?? 0;
  const eventsToGo  = Math.max(0, 3 - eventsDone);
  const canHost     = ["Activity Manager", "Partner", "SysAdmin"].includes(profile?.role);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Volunteer mode</h1>
          <div className="sub">Show up. Get verified by event staff. Earn clan points.</div>
        </div>
        <div className="right">
          {canHost ? (
            <div className="host-cluster">
              <button className="btn btn-primary"><Icon name="plus" size={16}/> Host an event</button>
              <small className="role-note">As {profile.role}, you can host</small>
            </div>
          ) : (
            <div className="host-cluster">
              <button className="btn btn-secondary" disabled title="Activity Managers and Partners can host">
                <Icon name="plus" size={16}/> Host an event
              </button>
              <small className="role-note">Activity Managers & Partners only</small>
            </div>
          )}
        </div>
      </div>

      <section className="vol-hero">
        <div>
          <h2>Verified attendance, not self-reported numbers.</h2>
          <p>Every event has 5 staff and 20 participant spots. Peer-verified events
             are confirmed on-site by elected staff; partner-verified events are run
             by NGOs and municipalities. Both roles earn clan points; staff get a
             10% bonus for the responsibility.</p>
          <div className={"eligibility-banner " + (eligible ? "ok" : "warn")}>
            {eligible
              ? <><Icon name="trophy" size={16}/> You're staff-eligible — {eventsDone} verified events</>
              : <><Icon name="leaf"   size={16}/> Complete {eventsToGo} more event{eventsToGo === 1 ? "" : "s"} to become staff</>}
          </div>
        </div>
        <div className="vol-impact">
          <div className="vol-impact-card">
            <div className="label">Your events</div>
            <div className="value">{eventsDone}</div>
          </div>
          <div className="vol-impact-card">
            <div className="label">Your points</div>
            <div className="value">{(stats.volunteerPoints ?? 0).toLocaleString()}</div>
          </div>
          <div className="vol-impact-card">
            <div className="label">Clan points</div>
            <div className="value">8,620</div>
          </div>
          <div className="vol-impact-card">
            <div className="label">Hours</div>
            <div className="value">12</div>
          </div>
        </div>
      </section>

      <div className="vol-filters">
        {["All","Beach","Trail","River","Easy","Moderate","Hard"].map(f =>
          <button key={f} className={filter===f?"active":""} onClick={() => setFilter(f)}>{f}</button>
        )}
      </div>

      <div className="vol-grid">
        {filtered.map(ev => (
          <VolunteerEventCard key={ev.id} event={ev}
                              eligible={eligible} eventsToGo={eventsToGo}/>
        ))}
      </div>
    </>
  );
}

function VolunteerEventCard({ event: ev, eligible, eventsToGo }) {
  const isStaff       = ev.userRole === "staff";
  const isParticipant = ev.userRole === "participant";
  const staffFull     = ev.staffJoined        >= ev.staffSpots;
  const partFull      = ev.participantsJoined >= ev.participantSpots;

  return (
    <article className="vol-card" style={{ borderLeftColor: ev.color }}>
      <div className="vol-head">
        <div style={{ minWidth: 0 }}>
          <h3>{ev.title}</h3>
          <div className="when">{ev.date} · hosted by {ev.host}</div>
        </div>
        <div className="vol-head-tags">
          <span className="pill">+{ev.pointsParticipant} pts</span>
          {ev.verifiedBy === "partner"
            ? <span className="pill partner">🏛️ Partner-verified</span>
            : <span className="pill">👥 Peer-verified</span>}
          {ev.userRole && <span className="pill gold">You're in</span>}
        </div>
      </div>

      <div className="vol-meta">
        <div><Icon name="pin" size={14}/> {ev.location}</div>
        <div><Icon name="ruler" size={14}/> {ev.distanceKm} km</div>
      </div>
      <div className="vol-tags">
        {ev.tags.map(t => <span key={t} className="pill gray">{t}</span>)}
      </div>

      <RoleSection label="Staff" iconName="trophy"
                   bonusLabel={`+${ev.pointsStaff} pts · 10% bonus`}
                   joined={ev.staffJoined} spots={ev.staffSpots}
                   preview={ev.staffPreview} showEmpties
                   button={
                     isStaff       ? <button className="btn role-btn joined" disabled>✓ You're staff</button>
                   : staffFull     ? <button className="btn btn-secondary role-btn" disabled>Staff full</button>
                   : eligible      ? <button className="btn btn-secondary role-btn">Join as staff</button>
                                   : <button className="btn role-btn locked" disabled>
                                       <Icon name="logout" size={14}/> Need {eventsToGo} more event{eventsToGo===1?"":"s"}
                                     </button>
                   }/>

      <RoleSection label="Participants" iconName="user"
                   bonusLabel={`+${ev.pointsParticipant} pts`}
                   joined={ev.participantsJoined} spots={ev.participantSpots}
                   preview={ev.participantsPreview}
                   button={
                     isParticipant ? <button className="btn role-btn joined" disabled>✓ You're a participant</button>
                   : partFull      ? <button className="btn btn-secondary role-btn" disabled>Event full</button>
                                   : <button className="btn btn-primary role-btn">Join as participant</button>
                   }/>
    </article>
  );
}

function RoleSection({ label, iconName, bonusLabel, joined, spots, preview, showEmpties, button }) {
  const overflow = joined - preview.length;
  const empties  = Math.max(0, spots - joined);
  return (
    <div className="role-section">
      <div className="role-head">
        <div className="role-title">
          <Icon name={iconName} size={14}/>
          <strong>{label}</strong>
          <span className="role-bonus">{bonusLabel}</span>
        </div>
        <span className="role-count">{joined}/{spots}</span>
      </div>
      <div className="role-avatars">
        {preview.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size="sm"/>)}
        {overflow > 0 && <span className="more">+{overflow}</span>}
        {showEmpties && Array.from({ length: empties }).map((_, i) =>
          <span key={"e"+i} className="empty-slot"/>
        )}
      </div>
      {button}
    </div>
  );
}

/* -----------------------------------------------------------
   PROFILE
   ----------------------------------------------------------- */
function Profile({ profile }) {
  if (!profile) return <div className="boot">Loading profile…</div>;
  const max = Math.max(...profile.weeklyKm, 1);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Profile</h1>
          <div className="sub">Your runs, your stats, your impact</div>
        </div>
      </div>

      <section className="profile-head">
        <Avatar name={profile.name} color={profile.color} size="xl"/>
        <div className="who">
          <h2>{profile.name}</h2>
          <div className="handle">{profile.handle}</div>
          <span className="clan-tag-pill">
            <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--green-500)" }}/>
            {profile.clan.name} · {profile.clan.tag}
          </span>
          {profile.role && (
            <span className="pill partner" style={{ marginLeft: 8 }}>
              {profile.role}
            </span>
          )}
        </div>
        <div className="profile-actions">
          <button className="btn btn-secondary" style={{ width:"auto" }}>Share profile</button>
          <button className="btn btn-primary" style={{ width:"auto" }}>Edit</button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon="ruler"  label="This month" value={`${profile.stats.monthKm} km`} sub={`${profile.stats.monthRuns} runs`}/>
        <StatCard icon="zap"    label="Avg pace"   value={`${profile.stats.avgPace}/km`} sub="Top 8% of your clan"/>
        <StatCard icon="leaf"   label="Volunteer"  value={`${profile.stats.volunteerEvents} events`} sub={`${profile.stats.volunteerPoints} pts · ${profile.stats.staffEligible ? "staff-eligible" : "need 3 events for staff"}`}/>
        <StatCard icon="flame"  label="Streak"     value={`${profile.stats.streak} days`} sub="Personal best: 14"/>
      </section>

      <section className="profile-grid">
        <div className="card weekly">
          <div className="card-title">
            <h3>Weekly distance</h3>
            <small>{profile.weeklyKm.reduce((a,b)=>a+b,0).toFixed(1)} km this week</small>
          </div>
          <div className="bars-lg">
            {profile.weeklyKm.map((v,i) => (
              <div key={i} className="bar-wrap">
                <div className={"bar " + (v===0?"empty":"")}
                     style={{ height: `${(v/max)*100}%` }}>
                  {v > 0 && <span className="km">{v.toFixed(1)}</span>}
                </div>
                <span className="day">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h3>Achievements</h3>
            <small>{profile.achievements.length} earned</small>
          </div>
          <div className="achievements">
            {profile.achievements.map((a,i) => (
              <div key={i} className="achievement">
                <div className="ico">{a.icon}</div>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.sub}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="icon"><Icon name={icon} size={18}/></div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

/* -----------------------------------------------------------
   SHELL — sidebar + nav
   ----------------------------------------------------------- */
const NAV = [
  { id: "feed",      label: "Feed",          icon: "home"   },
  { id: "track",     label: "Last run",      icon: "run"    },
  { id: "ranking",   label: "Clan ranking",  icon: "trophy" },
  { id: "volunteer", label: "Volunteer",     icon: "leaf"   },
  { id: "profile",   label: "Profile",       icon: "user"   },
];

function Sidebar({ active, onNavigate, onSignOut, profile }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="30" height="30"/>
        Tribo
      </div>

      <div className="nav-section">Main</div>
      {NAV.map(item => (
        <button key={item.id}
                className={"nav-item " + (active === item.id ? "active" : "")}
                onClick={() => onNavigate(item.id)}>
          <Icon name={item.icon} size={18}/>
          <span>{item.label}</span>
        </button>
      ))}

      <div className="nav-section">Account</div>
      <button className="nav-item"><Icon name="bell"     size={18}/><span>Notifications</span></button>
      <button className="nav-item"><Icon name="settings" size={18}/><span>Settings</span></button>
      <button className="nav-item" onClick={onSignOut}>
        <Icon name="logout" size={18}/><span>Sign out</span>
      </button>

      <div className="sidebar-bottom">
        <Avatar name={profile?.name || "Ana Costa"} color={profile?.color || "#00B86B"} size="sm"/>
        <div className="who">
          <strong>{profile?.name || "Ana Costa"}</strong>
          <small>{profile?.clan?.name || "Forest Runners"}</small>
          {profile?.role && <span className="role-chip">{profile.role}</span>}
        </div>
      </div>
    </aside>
  );
}

/* -----------------------------------------------------------
   ROOT
   ----------------------------------------------------------- */
function App() {
  const [authed, setAuthed]   = useState(true);   // start signed-in for screenshots
  const [screen, setScreen]   = useState("feed");
  const [profile, setProfile] = useState(null);

  useEffect(() => { fetchJson("/api/profile", null).then(setProfile); }, []);

  if (!authed) return <Login onSignIn={() => setAuthed(true)}/>;

  const screens = {
    feed:      <Feed       profile={profile}/>,
    track:     <Tracker/>,
    ranking:   <Ranking    profile={profile}/>,
    volunteer: <Volunteer  profile={profile}/>,
    profile:   <Profile    profile={profile}/>,
  };

  return (
    <div className="shell">
      <Sidebar active={screen}
               onNavigate={setScreen}
               onSignOut={() => setAuthed(false)}
               profile={profile}/>
      <main className="main">{screens[screen]}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
