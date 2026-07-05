// src/components/ClanRankingSection.tsx
// The clan leaderboard — podium + table, switchable by metric and period.
// Extracted from the old RankingPage so it can live inside the Clan tab
// (ClanPage) alongside clan management. Real aggregates from GET /clans/ranking.
import { useEffect, useState } from "react";
import { getRanking, type ClanRankRow, type RankMetric, type RankPeriod } from "../api/clans";
import { formatPace } from "../lib/run";

const METRICS: { id: RankMetric; label: string }[] = [
  { id: "avgPace", label: "Avg pace" },
  { id: "distance", label: "Distance" },
  { id: "consistency", label: "Consistency" },
  { id: "impact", label: "Impact" },
];
const PERIODS: { id: RankPeriod; label: string }[] = [
  { id: "all", label: "All-time" },
  { id: "month", label: "This month" },
  { id: "week", label: "This week" },
];

function distanceFor(c: ClanRankRow, period: RankPeriod): number {
  return period === "week" ? c.weeklyKm : period === "month" ? c.monthlyKm : c.totalKm;
}

function headline(c: ClanRankRow, metric: RankMetric, period: RankPeriod): { value: string; unit: string } {
  switch (metric) {
    case "distance": return { value: distanceFor(c, period).toFixed(0), unit: "km" };
    case "consistency": return { value: String(c.consistencyPct), unit: "%" };
    case "impact": return { value: c.volunteerPoints.toLocaleString(), unit: "pts" };
    default: return { value: formatPace(c.avgPaceSecPerKm), unit: "/km" };
  }
}

export function ClanRankingSection({ myClanId, onClanClick }: { myClanId: string | null; onClanClick?: (id: string, name: string, tag: string, color: string) => void }) {
  const [metric, setMetric] = useState<RankMetric>("avgPace");
  const [period, setPeriod] = useState<RankPeriod>("all");
  const [clans, setClans] = useState<ClanRankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRanking(metric, period);
        if (!cancelled) setClans(r.clans);
      } catch {
        if (!cancelled) setClans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metric, period]);

  function change<T>(setter: (v: T) => void, v: T) {
    setLoading(true);
    setter(v);
  }

  const periodLabel = period === "week" ? "this week" : period === "month" ? "this month" : "all-time";
  const [first, second, third] = clans;

  return (
    <section className="clan-ranking">
      <div className="topbar" style={{ marginTop: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Leaderboard</h2>
          <div className="sub">Live · weekly reset Sun 23:59</div>
        </div>
        <div className="right">
          <div className="tabs">
            {METRICS.map((m) => (
              <button key={m.id} className={metric === m.id ? "active" : ""} onClick={() => change(setMetric, m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="period-bar">
        <span className="period-label">Period</span>
        <div className="tabs period-tabs">
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? "active" : ""} onClick={() => change(setPeriod, p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="state-msg">Loading rankings…</p>}
      {!loading && clans.length === 0 && <p className="state-msg">No clans yet. Create one above.</p>}

      {clans.length > 0 && (
        <>
          <div className="podium">
            <PodiumCard clan={second} place={2} metric={metric} period={period} periodLabel={periodLabel} onClick={() => second && onClanClick?.(second.id, second.name, second.tag, second.color)} />
            <PodiumCard clan={first} place={1} metric={metric} period={period} periodLabel={periodLabel} crown onClick={() => first && onClanClick?.(first.id, first.name, first.tag, first.color)} />
            <PodiumCard clan={third} place={3} metric={metric} period={period} periodLabel={periodLabel} onClick={() => third && onClanClick?.(third.id, third.name, third.tag, third.color)} />
          </div>

          <div className="clan-table">
            <div className="clan-row head">
              <span>#</span>
              <span>Clan</span>
              <span>Avg pace</span>
              <span>Distance · {periodLabel}</span>
              <span>Impact</span>
            </div>
            {clans.map((c) => (
              <div key={c.id} className={"clan-row " + (c.id === myClanId ? "mine" : "")} onClick={() => onClanClick?.(c.id, c.name, c.tag, c.color)} style={{ cursor: onClanClick ? "pointer" : "default" }}>
                <span className="rk">{c.rank}</span>
                <div className="clan-name">
                  <span className="clan-tag" style={{ background: c.color }}>{c.tag}</span>
                  <div>
                    <strong>
                      {c.name}
                      {c.id === myClanId && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>You</span>}
                    </strong>
                    <small>{c.members} member{c.members === 1 ? "" : "s"} · {c.consistencyPct}% active this week</small>
                  </div>
                </div>
                <span className="num">{formatPace(c.avgPaceSecPerKm)}<small>/km</small></span>
                <span className="num">{distanceFor(c, period).toFixed(0)}<small>km</small></span>
                <span className="num">
                  {c.volunteerPoints.toLocaleString()}<small>pts</small>{" "}
                  <span style={{
                    color: c.trend === "up" ? "var(--green-600)" : c.trend === "down" ? "var(--danger)" : "var(--muted)",
                    fontWeight: 700,
                  }}>
                    {c.trend === "up" ? "↑" : c.trend === "down" ? "↓" : "→"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PodiumCard({
  clan, place, metric, period, periodLabel, crown, onClick,
}: {
  clan?: ClanRankRow;
  place: number;
  metric: RankMetric;
  period: RankPeriod;
  periodLabel: string;
  crown?: boolean;
  onClick?: () => void;
}) {
  if (!clan) return <div />;
  const h = headline(clan, metric, period);
  return (
    <div className={"podium-card " + (place === 1 ? "first" : "")} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {crown && <div className="crown">👑</div>}
      <div className={"medal " + (place === 1 ? "gold" : place === 2 ? "silver" : "bronze")}>{place}</div>
      <div className="name">
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: clan.color, marginRight: 6 }} />
        {clan.name}
      </div>
      <div className="headline">
        {h.value}
        <small style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginLeft: 4 }}>{h.unit}</small>
      </div>
      <div className="meta">{clan.members} members · {distanceFor(clan, period).toFixed(0)} km {periodLabel}</div>
    </div>
  );
}
