// src/pages/FeedPage.tsx
// Sprint 3 Phase 4: the activity feed — a unified, newest-first timeline of runs
// and volunteer joins from everyone (All) or your clan (My clan), with kudos.
import { useEffect, useState } from "react";
import { getFeed, likeItem, unlikeItem, type FeedItem } from "../api/feed";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { RouteMap } from "../components/RouteMap";
import { formatPace, formatDuration } from "../lib/run";
import { formatWhen } from "../lib/activity";

type Scope = "all" | "clan";

export function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await getFeed(scope);
        if (!cancelled) setItems(fetched);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  function switchScope(next: Scope) {
    if (next === scope) return;
    setLoading(true);
    setScope(next);
  }

  function patch(id: string, changes: Partial<FeedItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }

  async function toggleKudos(item: FeedItem) {
    // Optimistic; reconcile count from the server on like.
    if (item.likedByMe) {
      patch(item.id, { likedByMe: false, kudosCount: Math.max(0, item.kudosCount - 1) });
      try { await unlikeItem(item.id); } catch { patch(item.id, { likedByMe: true, kudosCount: item.kudosCount }); }
    } else {
      patch(item.id, { likedByMe: true, kudosCount: item.kudosCount + 1 });
      try {
        const r = await likeItem(item.id);
        patch(item.id, { likedByMe: r.likedByMe, kudosCount: r.kudosCount });
      } catch {
        patch(item.id, { likedByMe: false, kudosCount: item.kudosCount });
      }
    }
  }

  return (
    <Shell>
      <div className="topbar">
        <div>
          <h1>Activity feed</h1>
          <div className="sub">Runs and volunteer events from your clan and the wider tribe</div>
        </div>
        <div className="right">
          <div className="tabs">
            <button className={scope === "all" ? "active" : ""} onClick={() => switchScope("all")}>All</button>
            <button className={scope === "clan" ? "active" : ""} onClick={() => switchScope("clan")}>My clan</button>
          </div>
        </div>
      </div>

      {loading && <p className="state-msg">Loading feed…</p>}
      {!loading && items.length === 0 && (
        <p className="state-msg">
          Nothing here yet. Log a run or join a volunteer event to start the feed.
        </p>
      )}

      <div className="feed-list">
        {items.map((it) => (
          <FeedCard key={it.id} item={it} onKudos={() => toggleKudos(it)} />
        ))}
      </div>
    </Shell>
  );
}

function FeedCard({ item, onKudos }: { item: FeedItem; onKudos: () => void }) {
  const isVol = item.type === "volunteer";
  return (
    <article className="feed-card">
      <div className="feed-head">
        <Avatar name={item.author.name} color={item.author.color} />
        <div className="who">
          <strong>{item.author.name}</strong>
          <small>
            {[item.author.clanName, formatWhen(item.when), item.location].filter(Boolean).join(" · ")}
          </small>
        </div>
        {isVol ? (
          <span className="pill">🌱 Volunteer · {item.role === "STAFF" ? "staff" : "runner"}</span>
        ) : (
          <span className="pill gray">Run</span>
        )}
      </div>

      <h3 className="feed-title">{item.title}</h3>

      <div className="feed-stats">
        <Metric label="Distance" value={item.distanceKm ?? 0} unit="km" />
        {isVol ? (
          <>
            <Metric label="Points" value={`+${item.pointsEarned ?? 0}`} unit="pts" />
            <Metric label="Role" value={item.role === "STAFF" ? "Staff" : "Runner"} />
            <Metric label="Verified" value={item.verifiedBy === "PARTNER" ? "Partner" : "Peer"} />
          </>
        ) : (
          <>
            <Metric label="Pace" value={formatPace(item.paceSecPerKm)} unit="/km" />
            <Metric label="Time" value={formatDuration(item.durationSeconds ?? 0)} />
            <Metric label="Elev" value={item.elevationMeters ?? 0} unit="m" />
          </>
        )}
      </div>

      {!isVol && (
        <div className="feed-map"><RouteMap variant={item.routeType ?? "river"} /></div>
      )}

      <div className="feed-actions">
        <button className={item.likedByMe ? "liked" : ""} onClick={onKudos}>
          <Icon name="heart" size={16} /> {item.kudosCount}
        </button>
        <button disabled title="Comments coming soon">
          <Icon name="comment" size={16} /> {item.commentCount}
        </button>
        <span className="spacer" />
        {isVol && (
          <span className={item.verifiedBy === "PARTNER" ? "pill partner" : "pill"}>
            {item.verifiedBy === "PARTNER" ? "🏛️ Partner-verified" : "👥 Peer-verified"}
          </span>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}
