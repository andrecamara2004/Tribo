// src/pages/LandingPage.tsx
// Public marketing page at "/", ported from the approved PROTOTYPE landing
// (PROTOTYPE/src/main/webapp/index.html). Styles live in LandingPage.css,
// scoped under `.landing-page` so they don't collide with the app shell.
// All CTAs route to /login. The ranking preview is a static teaser (the public
// page needs no auth); the live board lives behind sign-in on the Clan tab.
import { Link } from "react-router-dom";
import "./LandingPage.css";

const PREVIEW_CLANS = [
  { rank: 1, name: "Forest Runners", meta: "412 km this week", pace: "4:42", color: "#00B86B" },
  { rank: 2, name: "Tagus Tide", meta: "388 km this week", pace: "4:55", color: "#0EA5E9" },
  { rank: 3, name: "Monsanto Wolves", meta: "356 km this week", pace: "5:01", color: "#F4B400" },
  { rank: 4, name: "Caparica Coast", meta: "340 km this week", pace: "5:08", color: "#A855F7" },
  { rank: 5, name: "Sintra Trail Co.", meta: "high vertical gain", pace: "5:20", color: "#EF4444" },
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="lp-nav">
        <Link className="lp-logo" to="/">
          <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="32" height="32" />
          <span>Tribo</span>
        </Link>
        <nav className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#clans">Clans</a>
          <a href="#volunteer">Volunteer</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="lp-nav-cta">
          <Link to="/login" className="lp-btn lp-btn-ghost">Sign in</Link>
          <Link to="/login" className="lp-btn lp-btn-primary">Open the app</Link>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-hero-text">
            <span className="lp-eyebrow">FOR RUNNERS WHO MOVE TOGETHER</span>
            <h1>Run together. Compete together.<br /><span className="lp-grad">Make impact.</span></h1>
            <p className="lp-lede">
              Tribo turns your runs into a team sport. Form a clan, climb the rankings,
              and clean up your city while you're at it.
            </p>
            <div className="lp-cta-row">
              <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">Get started</Link>
              <a href="#features" className="lp-btn lp-btn-secondary lp-btn-lg">See how it works</a>
            </div>
            <div className="lp-hero-meta">
              <div><strong>5</strong><span>active clans</span></div>
              <div><strong>11k</strong><span>km this month</span></div>
              <div><strong>320</strong><span>verified events</span></div>
            </div>
          </div>

          <div className="lp-hero-mock">
            <div className="lp-phone">
              <div className="lp-phone-notch" />
              <div className="lp-phone-screen">
                <div className="lp-phone-top">
                  <span className="lp-dot lp-dot-green" />
                  <span>Live run (mobile) · Forest Runners</span>
                </div>
                <div className="lp-phone-metric">
                  <span className="lp-metric-label">Distance</span>
                  <span className="lp-metric-value">5.42 <em>km</em></span>
                </div>
                <div className="lp-phone-row">
                  <div><span>Pace</span><strong>4:51</strong></div>
                  <div><span>Time</span><strong>26:18</strong></div>
                </div>
                <div className="lp-phone-map">
                  <svg viewBox="0 0 200 90" preserveAspectRatio="none" width="100%" height="100%">
                    <defs>
                      <linearGradient id="lpMapBg" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#E8F7EF" />
                        <stop offset="100%" stopColor="#D5F0E1" />
                      </linearGradient>
                    </defs>
                    <rect width="200" height="90" fill="url(#lpMapBg)" />
                    <path d="M5 70 Q40 30 80 50 T140 35 T195 25" stroke="#00B86B" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <circle cx="195" cy="25" r="4" fill="#00B86B" />
                  </svg>
                </div>
                <div className="lp-phone-rank">
                  <span className="lp-rank-tag">#1</span>
                  <div>
                    <strong>Forest Runners</strong>
                    <small>4:42 avg pace · 412 km this week</small>
                  </div>
                  <span className="lp-trend">↑</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="lp-features">
          <span className="lp-eyebrow lp-center">WHAT MAKES TRIBO DIFFERENT</span>
          <h2>It's not just your run.<br />It's <em>your clan's</em> run.</h2>

          <div className="lp-feature-grid">
            <Feature title="Run as a clan"
              body="Pull your friends — or your gym, your faculty, your neighborhood — into a clan. Every kilometer counts toward the team.">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </Feature>
            <Feature title="Rankings that matter"
              body="Leaderboards by average pace or total kilometers — so the small fast clan and the big patient clan can both win on their terms.">
              <path d="M3 21h18M5 21V10l4-2v13M13 21V6l4-2v17" /><path d="M19 21V14" />
            </Feature>
            <Feature title="Volunteer runs"
              body="Clean up streets and trails while you train. Plogging routes, group cleanups, and impact tracked per clan.">
              <path d="M12 2 14 8h6l-5 4 2 7-7-4-7 4 2-7-5-4h6z" />
            </Feature>
            <Feature title="Local routes"
              body="Tagus, Monsanto, Sintra, Caparica. Built around the places your clan actually runs.">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </Feature>
            <Feature title="GPS tracking on mobile"
              body="Pace, splits, distance, route. Track on the phone, review on the web — every kilometer feeds the clan leaderboard.">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </Feature>
            <Feature title="Clan achievements"
              body="Streaks, podiums, eco-runner badges. Earn them solo, share them with your tribe.">
              <circle cx="12" cy="8" r="6" /><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5" />
            </Feature>
          </div>
        </section>

        {/* CLAN RANKING PREVIEW */}
        <section id="clans" className="lp-ranking-section">
          <div className="lp-ranking-text">
            <span className="lp-eyebrow">RANKINGS · UPDATED LIVE</span>
            <h2>Two ways to climb.<br />Same trophy.</h2>
            <p>
              Big-team clans grind out kilometers. Small fast clans drop their average pace.
              Tribo lets both fight for the top — pick your metric, defend your rank.
            </p>
            <ul className="lp-check-list">
              <li>Weekly resets, season-long titles</li>
              <li>Per-clan dashboards and member contributions</li>
              <li>Verified events count toward an Impact rank</li>
            </ul>
            <Link to="/login" className="lp-btn lp-btn-primary">See the live board</Link>
          </div>

          <div className="lp-ranking-card">
            <div className="lp-ranking-head">
              <strong>Top clans · this week</strong>
              <div className="lp-ranking-tabs">
                <button className="active">Avg pace</button>
                <button>Total km</button>
                <button>Impact</button>
              </div>
            </div>
            <ul className="lp-ranking-list">
              {PREVIEW_CLANS.map((c) => (
                <li key={c.rank}>
                  <span className={"lp-rk" + (c.rank === 1 ? " lp-rk-1" : "")}>{c.rank}</span>
                  <div className="lp-clan-line">
                    <strong><span className="lp-clan-dot" style={{ background: c.color }} />{c.name}</strong>
                    <small>{c.meta}</small>
                  </div>
                  <span className="lp-clan-pace">{c.pace}<small style={{ fontSize: 12, color: "var(--muted)" }}>/km</small></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* VOLUNTEER */}
        <section id="volunteer" className="lp-volunteer">
          <div className="lp-volunteer-card">
            <span className="lp-eyebrow">RUN WITH PURPOSE</span>
            <h2>Show up.<br />Get verified.<br />Earn clan points.</h2>
            <p>
              Most fitness apps pretend the city around you doesn't exist. Tribo doesn't.
              Volunteer events are run by elected staff members from the community —
              they check participants in on-site so the points your clan earns are real.
            </p>
            <p>
              Five staff slots, twenty participant slots, no self-reported numbers.
              Staff get a 10% point bonus for the responsibility, and you become
              eligible to be staff after three verified events of your own.
            </p>
            <Link to="/login" className="lp-btn lp-btn-primary">Join a cleanup run</Link>
          </div>
          <div className="lp-volunteer-art">
            <div className="lp-badge">+110 pts</div>
            <div className="lp-badge lp-badge-2">Staff role</div>
            <div className="lp-badge lp-badge-3">5 verifiers</div>
            <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
              <defs>
                <radialGradient id="lpLeafGrad" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#00D97A" />
                  <stop offset="100%" stopColor="#008F4F" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="86" fill="url(#lpLeafGrad)" />
              <path d="M100 40 C70 70 60 100 60 130 a40 40 0 0 0 80 0 C140 100 130 70 100 40 Z" fill="#FFFFFF" opacity="0.18" />
              <path d="M100 60 C82 80 75 100 75 122 a25 25 0 0 0 50 0 C125 100 118 80 100 60 Z" fill="#FFFFFF" opacity="0.28" />
            </svg>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="lp-how">
          <span className="lp-eyebrow lp-center">HOW IT WORKS</span>
          <h2>Four steps. No friction.</h2>
          <ol className="lp-steps">
            <li><span>1</span><h3>Create or join a clan</h3><p>Up to 20 members. Pick a tag, a color, and a city.</p></li>
            <li><span>2</span><h3>Track your runs</h3><p>GPS, pace, heart rate. Solo or with friends.</p></li>
            <li><span>3</span><h3>Climb the ranking</h3><p>Average pace, total km, or volunteer impact.</p></li>
            <li><span>4</span><h3>Run with purpose</h3><p>Plogging routes turn training into impact.</p></li>
          </ol>
        </section>

        {/* FINAL CTA */}
        <section className="lp-final-cta">
          <h2>Your clan is waiting.</h2>
          <p>Create an account and look around — every screen is real.</p>
          <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">Open the Tribo app</Link>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-logo lp-footer-logo">
            <img src="/assets/TriboLogo_NoBackground.png" alt="Tribo" width="24" height="24" />
            <span>Tribo</span>
          </div>
          <p className="lp-footer-meta">NOVA FCT · 2026</p>
          <p className="lp-footer-meta">Built with Java + React + Flutter</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <article className="lp-feature">
      <div className="lp-feature-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
          {children}
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
