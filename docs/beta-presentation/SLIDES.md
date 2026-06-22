# Tribo — BETA Presentation Deck (Plenary)

**Session:** 24 June, 14h00 — Sala 1B Ed. VII · **Time budget: 10 minutes** · Audience: all teams' students + professors

> How to use this file: each slide has **[SLIDE]** content (what goes *on* the slide — keep it sparse) and **[SAY]** speaker notes (what you say out loud, with a rough time). The `(a)…(h)` tags map to the professors' BETA checklist so they can tick boxes. Paste `[SLIDE]` blocks into PowerPoint/Google Slides; keep `[SAY]` as your notes.
>
> Deployed and live during the talk:
> - **Web:** https://web-dot-tribo-497810.ew.r.appspot.com
> - **API:** https://tribo-497810.ew.r.appspot.com/rest

---

## Slide 1 — Title / Hook  · 0:00–0:15

**[SLIDE]**
- **Tribo**
- *Run together. Compete together. Make impact.*
- Team members: André Câmara, Rafael Rodrigues, Ricardo Píneu, João Duarte, Martinho Pereira
- BETA status update — June 2026

**[SAY]** (15s)
"We're Tribo. Since ALFA we went from a concept to a **live, cloud-deployed full-stack platform** — web, mobile, and a Java backend running on Google Cloud right now. In the next ten minutes I'll show you what's actually built and working."

---

## Slide 2 — Idea & objectives, refined  · 0:15–1:15  *(consolidation/refinement)*

**[SLIDE]**
- **The problem:** running is solo; cities need volunteers; both lack a reason to keep showing up.
- **Tribo's answer:** clans turn running into a *team sport*, and volunteer "impact runs" turn training into community work.
- **Refined since ALFA:** sharper scope — clans + ranked competition + a verified volunteer-event system, all on one shared activity catalog.

**[SAY]** (1m)
"The idea is simple: people run more when they run *for* a team. So in Tribo you join a **clan**, every kilometre counts toward your clan's ranking, and you can join **volunteer runs** — clean-up events, community runs — that earn impact points. Since ALFA we tightened the scope around three pillars: clans and competition, a shared activity catalog, and a *verified* volunteer system. Everything I show next is implemented, not a mockup."

---

## Slide 3 — Architecture & stack  · 1:15–2:15  *(BETA: architecture + cloud-enabled)*

**[SLIDE]** (one diagram)
```
  Flutter (Android)        React + Vite (Web)
          \                      /
           \   JWT / REST       /
            ▼                  ▼
        JAX-RS API  (Java 21, Jersey)
                 │   App Engine Standard
                 ▼
   Firestore (Datastore mode)  +  Secret Manager
```
- 2 App Engine services live: **API** (default) + **Web**
- Auth: JWT access + refresh tokens · secrets in Secret Manager
- Both clients share one backend contract

**[SAY]** (1m)
"Architecture is consolidated and deployed. A Java 21 JAX-RS API runs on **App Engine Standard**, backed by **Firestore in Datastore mode**, with the JWT signing secret in **Secret Manager**. Two clients — a **Flutter** Android app and a **React** web app — talk to the same REST API over JWT. It's two App Engine services, both live in the cloud right now, on the URLs at the bottom of the slide. This is the 'cloud-enabled full-stack platform' the BETA asked for."

---

## Slide 4 — IAM / Auth  · 2:15–3:15  *(a)*

**[SLIDE]**
- **5 roles:** END_USER · ACTIVITY_MANAGER · PARTNER · BACKOFFICE · SYSADMIN
- **Backend operations:** register · login · token refresh · logout (revocation)
- Backoffice user management: **verify** managers/partners · **suspend / unsuspend**
- Hardened: bcrypt hashing · per-IP login rate-limiting · role-gated endpoints

**[SAY]** (1m)
"IAM is fully working. Five roles with real access control. The backend supports register, login, token refresh, and logout with token revocation. Backoffice staff can **verify** activity managers and **suspend** abusive accounts. It's hardened — passwords are bcrypt-hashed, login is rate-limited per IP, and every endpoint is gated by role. This is checklist item (a)."

---

## Slide 5 — Activity & event management  · 3:15–4:45  *(b)* — **richest slide, give it room**

**[SLIDE]**
- **Lifecycle:** DRAFT → **PENDING_APPROVAL → PUBLISHED** → REJECTED / CANCELLED
- **Approval workflow (catalog & advertisement):** manager/partner *creates* → backoffice *approves* → appears in public catalog
- **Discovery:** published activities listed + filterable, paginated
- **Participation:** join as participant or **staff**; capacity checks; staff eligibility gate
- **Volunteer events:** points for participants & staff, peer/partner verification

**[SAY]** (1m30)
"This is the core of the platform — checklist item (b). Activities move through a real **state machine**. When a manager creates an activity it goes to **PENDING_APPROVAL** — it is *not* public yet. A backoffice user reviews and **approves** it, and only then does it enter the public catalog. That's our catalog-and-advertisement flow with moderation built in. Users then **join** activities — as a participant, or as **staff** for volunteer events once they've earned eligibility — with capacity enforced on the backend. Volunteer events award **impact points** and carry a verification badge. I'll show this approval flow end-to-end in the demo — it's the part I'm most proud of."

---

## Slide 6 — Maps  · 4:45–5:30  *(c)*

**[SLIDE]**
- Every activity carries **lat/lng** (validated on the backend)
- **Web:** discovery map — all published activities as pins → click → details
- **Web:** location **picker** when creating/editing an activity
- **Mobile:** map-based **Find** tab

**[SAY]** (45s)
"Maps are integrated — checklist (c). Activities store coordinates, validated server-side. On the web, there's a discovery map where every published activity is a pin you can click through to details, and managers place the location with a click-to-pick map when they create an event. The mobile app has a map-based Find tab. Google Maps, real coordinates, both clients."

---

## Slide 7 — Web app — live demo  · 5:30–6:30  *(d)*

**[SLIDE]**
- Live at **web-dot-tribo-497810.ew.r.appspot.com**
- Demo path: Landing → Login → Feed → Clan leaderboard → **Backoffice: approve an activity**
- React + Vite · role-aware routing · deployed as a cloud service

**[SAY]** (1m) — *switch to the browser; see DEMO-SCRIPT.md*
"Let me show the web app — it's live, this is the deployed URL. [Landing] public landing page. [Login as backoffice/sysadmin] [Feed] the social feed of runs and volunteer joins. [Clan] the clan leaderboard. [Backoffice] and here's the moment — a manager submitted this activity, it's pending; I approve it… and it's now published in the public catalog. End to end, live."

---

## Slide 8 — Mobile app — live demo  · 6:30–7:30  *(e)*

**[SLIDE]**
- Flutter · Android · **running on the emulator now**
- 5 tabs: **Feed · Volunteer · Find (map) · Clan · Profile**
- Branded: native splash screen + adaptive launcher icon
- **APK build-ready**

**[SAY]** (1m) — *switch to the emulator; see DEMO-SCRIPT.md*
"Same platform, native on Android. Branded splash and launcher icon. After login you land on the **Feed**, then **Volunteer** activities, a map-based **Find**, the **Clan** rankings, and your **Profile** with stats and achievements. It shares the exact same backend as the web app, and it's packaged as an installable APK."

---

## Slide 9 — Gamification & engagement  · 7:30–8:30  *(f)*

**[SLIDE]**
- **Clan leaderboard** — 4 metrics: avg pace · distance · consistency · impact, with week-over-week trend
- **Social feed** — kudos (likes) + comments on runs & volunteer joins
- **Volunteer points** + staff eligibility ladder
- **Achievements** (computed): sub-5 pace, century month, day streaks, eco-runner, trusted staff
- **Weekly distance goals**

**[SAY]** (1m)
"Engagement — checklist (f) — is where the 'why come back' lives. Clans are ranked four ways: average pace, total distance, weekly consistency, and volunteer impact, and we track whether you moved up or down week over week. There's a social feed with kudos and comments. Volunteer events build toward a staff-eligibility ladder. And profiles surface computed achievements and a weekly distance goal. These are the hooks that drive user adhesion."

---

## Slide 10 — Monetization & highlights  · 8:30–9:15  *(g)(h)*

**[SLIDE]**
- **Monetization (g):** foundation in place — **PARTNER role** + **partner-verified events** → path to sponsored/NGO events and premium clan features. *Payments: planned, not yet built (honest roadmap).*
- **Highlights (h):**
  - End-to-end activity **approval workflow**, live
  - Fully **cloud-deployed** (web + API + datastore + secrets)
  - **Web + mobile parity** on one backend
- **Next:** mobile GPS run-logging · payments · push notifications

**[SAY]** (45s)
"On monetization — checklist (g) — we've built the foundation: a **Partner** role and partner-verified events, which is the hook for sponsored events and future premium clan features. We're honest that payment processing isn't built yet — it's on the roadmap. Highlights: the live approval workflow, a fully cloud-deployed stack, and genuine web-and-mobile parity on one backend. Next up: GPS run-logging on mobile, payments, and push notifications."

---

## Slide 11 — Close  · 9:15–9:30

**[SLIDE]**
- **Tribo is live, full-stack, and cloud-deployed today.**
- Come see the full hands-on demo in our **LAB slot** (Lab 116).
- *Run together. Compete together. Make impact.*

**[SAY]** (15s)
"To wrap up: Tribo is a complete, live, full-stack platform today — IAM, an activity catalog with moderation, maps, gamification, on web and Android. Come to our LAB slot for the full hands-on demo. Thank you."

---

## Checklist coverage map (for your own check before submitting)

| Item | Topic | Slide |
|------|-------|-------|
| (a) | IAM + backend ops | 4 |
| (b) | Activity mgmt + catalog/advertisement | 5 |
| (c) | Maps | 6 |
| (d) | Web app demo | 7 |
| (e) | Mobile app demo | 8 |
| (f) | Gamification / adhesion | 9 |
| (g) | Monetization | 10 |
| (h) | Highlights | 10 |
| — | Architecture / cloud / team | 3 |

## Timing summary
0:00 title · 0:15 idea · 1:15 architecture · 2:15 IAM · 3:15 activities · 4:45 maps · 5:30 web demo · 6:30 mobile demo · 7:30 gamification · 8:30 monetization · 9:15 close → **lands at 9:30**, leaving 30s of buffer. If you're running long, the two demo slides (7, 8) are where you trim — keep each under a minute.
