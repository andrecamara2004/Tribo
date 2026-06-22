# Tribo — BETA Readiness & Plan

**Created:** 2026-06-08. Maps the course's BETA expectations to Tribo's current
state and lays out the prioritized path to a BETA demo.

---

## 1. BETA expectations (course rubric)

**Setup & consolidation**
- Setup of technology and development tools.
- Consolidation of architecture for the full-stack platform: **WEB / MOBILE +
  CLOUD-enabled** (computing + storage).
- Consolidation of team organization & coordination.
- A **BETA development / prototyping plan**.
- Responsibilities of team members.

**Development of functional areas — suggested PRIORITY for BETA**
- CORE functional areas: backend support for operations + WEB/Mobile support.
- **IAM** / user accounts, roles and access control.
- **Activity / event** data and event management.
- **Activity catalogs and advertisement.**
- **MAPS** — visualization, interaction, and data-bindings.
- BETA pilots for WEB and Mobile apps.

**BETA prototype & demo readiness**
- ANDROID emulated app.
- ANDROID APKs.
- WEB.
- Cloud-deployed backend services.

---

## 2. Key takeaway

The BETA core is **four functional areas** — **IAM, Activity/Event management,
Activity catalog/advertisement, MAPS** — delivered across **Web + Mobile +
Cloud**, plus **Android emulator + APK** artifacts and **planning docs**.

The social features already built (feed, clans, ranking, runs, kudos, comments,
achievements) are **beyond** the suggested BETA core — a bonus, not a
requirement. We are therefore **ahead on web/cloud**; the real gaps are **the
mobile app (maps especially)**, the **Android demo artifacts**, and the
**planning/coordination documents**.

---

## 3. Where we stand vs. the rubric

| BETA core area            | Cloud (API)        | Web                 | Mobile (Android)        |
|---------------------------|--------------------|---------------------|-------------------------|
| IAM / roles / access      | ✅                 | ✅                  | ✅                      |
| Activity & event mgmt     | ✅                 | ✅                  | ✅                      |
| Catalog / advertisement   | ✅                 | ✅ (list + map)     | ⚠️ basic list only      |
| **MAPS**                  | ✅ (Activity lat/lng) | ✅ Google Maps   | ❌ **none**             |
| Demo artifacts            | ✅ deployed        | ✅ deployed         | ❌ **no APK / emulator** |
| Planning docs             | backlog exists     | —                   | ❌ arch / team / plan    |

**Two real gaps:** mobile (maps especially) + the Android APK/emulator demo, and
the planning deliverables in rubric §1.

### Current deployments
- **API:** `https://tribo-497810.ew.r.appspot.com/rest` (App Engine `default`).
- **Web:** `https://web-dot-tribo-497810.ew.r.appspot.com` (App Engine `web`).
- **Mobile:** Flutter app with IAM + activity management only (Sprint 1–2);
  no maps, no built APK yet. Flutter SDK present at `C:\Users\andre\develop\flutter`.

---

## 4. Prioritized next steps

### P1 — Mobile MAPS *(critical path for BETA)*
Add `google_maps_flutter`: event-location pin on the activity detail screen + a
"Find activities" map mirroring the web. Requires a **Google Maps *Android SDK*
key** (separate from the web JS key) in `android/app/src/main/AndroidManifest.xml`;
billing is already enabled.

### P2 — Android demo artifacts
`flutter build apk` (release + debug), run on an emulator, and verify IAM +
activities + maps end-to-end against the live backend. Needs the Android
SDK/emulator (via Android Studio); `adb` isn't on PATH yet.

### P3 — Planning / coordination docs *(rubric §1; no toolchain needed)*
- **Architecture-consolidation doc** — web + mobile + App Engine services +
  Datastore + Secret Manager + Google Maps; request flows and auth.
- **BETA plan** retargeted to the four core areas (this doc + a tightened backlog).
- **Team responsibilities** — who owns which area/workstream.

### P4 — Hygiene (parallel)
- **SEC-2** — remove the weak `admin@admin.com` default + delete
  `scripts/promote_sysadmin.py`.
- **SEC-3** — lock CORS to the web origin (+ localhost), not `*`.
- **CI-1** — GitHub Actions: `mvn package`, `npm ci/build/lint`, **and a
  `flutter build apk` job**; pin Node 24 / npm 11.

---

## 5. Recommendation

The **mobile app is the BETA make-or-break.** Start **P1 (mobile maps)** and
write the **P3 planning/architecture docs** in parallel (they need no toolchain).
P2 (APK + emulator) follows once maps land; P4 hygiene runs alongside.

> Note: feature breadth is already strong — focus BETA effort on **mobile parity
> for the four core areas + the Android demo artifacts**, not on more web features.
