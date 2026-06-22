# Tribo — Architecture

**Status:** Consolidated for BETA. **Last updated:** 2026-06-08.
Companion to `api-contract.md` (the HTTP contract) and `beta-readiness.md` (the plan).

Tribo is a full-stack, cloud-native platform: a **Java REST API** + **React web
app** + **Flutter Android app**, all on **Google Cloud (App Engine + Firestore in
Datastore mode)**.

---

## 1. System overview

```
        ┌──────────────┐        ┌──────────────────┐
        │  Web (React) │        │ Mobile (Flutter, │
        │   SPA, Vite  │        │     Android)     │
        └──────┬───────┘        └─────────┬────────┘
               │  HTTPS  JSON + Bearer JWT │
               └────────────┬──────────────┘
                            ▼
            ┌───────────────────────────────┐
            │  REST API  (Jersey / JAX-RS)   │   App Engine service: default
            │  /rest/*  — Java 21            │   https://tribo-497810.ew.r.appspot.com
            │  JWT filter · RBAC · CORS      │
            └───────┬───────────────┬────────┘
                    │               │
        ┌───────────▼──────┐  ┌─────▼─────────────┐
        │ Firestore        │  │ Secret Manager    │
        │ (Datastore mode) │  │ tribo-jwt-secret  │
        └──────────────────┘  └───────────────────┘

  Maps: Google Maps JavaScript API (web) · Maps SDK for Android (mobile)
  Web is served as a separate App Engine service: web-dot-tribo-497810.ew.r.appspot.com
```

**GCP project:** `tribo-497810` (region `europe-west1`). Two App Engine services:
`default` (the API WAR) and `web` (the static built SPA). Mobile ships as an APK.

---

## 2. Components & tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| **API** | Java 21, Jersey (JAX-RS, Jakarta), Jackson, `java-jwt` (HS256), `jbcrypt`, `google-cloud-datastore`, `google-cloud-secretmanager` | WAR on App Engine Standard (Java 21). Entry: `web.xml` → Jersey servlet at `/rest/*`. |
| **Web** | React 19 + TypeScript, Vite, React Router, `@react-google-maps/api` | Static build (`dist/`) served by App Engine `web` service (`app.yaml` static handlers + SPA fallback). |
| **Mobile** | Flutter / Dart, `http`, `flutter_secure_storage`, `google_maps_flutter` | Android app; auth tokens in Keystore-backed secure storage. |
| **Data** | Firestore in Datastore mode | Single database; one "kind" per domain entity. |
| **Secrets** | Google Secret Manager | `tribo-jwt-secret` (JWT signing key); read at runtime by `JwtIssuer`. |
| **Maps** | Google Maps Platform | JS API key (web, referrer-restricted); Android SDK key (mobile, in `local.properties`). |

---

## 3. Datastore kinds (data model)

UUID-string keys; `Instant` stored as ISO-8601 strings; mapping lives in the
repositories. Aggregations (feed/ranking/stats) are computed per request.

| Kind | Key | Purpose |
|------|-----|---------|
| `User` | userId | account, role, `verified`, `suspended`, `clanId`, `weeklyGoalKm` |
| `RevokedToken` | jti | logout/refresh revocation list |
| `Clan` | clanId | team; members = users with that `clanId` |
| `Activity` | activityId | activity/event; volunteer fields + optional `latitude`/`longitude` |
| `Participation` | `{activityId}:{userId}` | join, with `role` PARTICIPANT/STAFF |
| `Run` | runId | logged run + embedded per-km splits |
| `Kudos` | `{itemId}::{userId}` | a like on a feed item |
| `Comment` | commentId | comment on a feed item (`itemId` indexed) |
| `RankSnapshot` | `{metric}:{period}:{isoWeek}:{clanId}` | weekly clan rank, for trend |

---

## 4. Functional areas → endpoints (BETA core in **bold**)

- **IAM / accounts / RBAC** — `POST /auth/{register,login,refresh,logout}`,
  `GET /ping-auth/whoami`, `GET /users/me`, `POST /users/{id}/verify`.
  JWT HS256 (access 15 min / refresh 7 days), roles `END_USER · ACTIVITY_MANAGER ·
  PARTNER · BACKOFFICE · SYSADMIN`.
- **Activity & event management** — `POST/GET/PUT /activities`, `/cancel`,
  participation `/{id}/participants` (+ role).
- **Catalog / advertisement** — `GET /activities` (status filter, paging);
  web list + mobile list.
- **MAPS** — `latitude`/`longitude` on `Activity`; web detail + `/discover`
  map; mobile detail map + Find-activities map.
- *Beyond beta core (already built):* Clans, Runs + stats, Volunteer-event
  extensions, Feed + kudos + comments, Clan ranking, Achievements/Goals.

---

## 5. Security architecture

- **AuthN:** `JwtAuthFilter` validates the Bearer access token on every non-public
  request and puts an `AuthenticatedUser` on the request.
- **AuthZ:** `@AllowedRoles` (via `RolesDynamicFeature`) for role gating;
  `OwnershipGuard` for owner-or-privileged resource access.
- **Secrets:** JWT signing key in Secret Manager (SEC-1) — never in source/config;
  rotatable by adding a secret version. Refresh tokens revocable (`RevokedToken`).
- **Passwords:** bcrypt (cost 12).
- **Transport:** App Engine serves HTTPS; CORS restricted to the web origin.

### Request flow (authenticated call)
```
client →  Authorization: Bearer <access>  → JwtAuthFilter → resource
   └─ on 401: client calls POST /auth/refresh (single-flight) → retries once
              refresh fails → session cleared → redirect/login
```

---

## 6. Environments & deployment

| | URL | Deploy |
|--|-----|--------|
| API | `https://tribo-497810.ew.r.appspot.com/rest` | `mvn -f api/pom.xml appengine:deploy` |
| Web | `https://web-dot-tribo-497810.ew.r.appspot.com` | `npm --prefix web run build` → `gcloud app deploy web/app.yaml` |
| Mobile | APK artifact | `flutter build apk` (key from `mobile/android/local.properties`) |

**Local dev:** API against the Datastore emulator (`DATASTORE_EMULATOR_HOST`,
project id must equal the app id) with a `JWT_SECRET` env var; web `npm run dev`;
mobile `flutter run`. See `api/README.md`.

**Config & secrets (not in VCS):** `web/.env` (`VITE_API_BASE`, `VITE_GOOGLE_MAPS_API_KEY`),
`mobile/android/local.properties` (`MAPS_API_KEY`), Secret Manager (`tribo-jwt-secret`).

---

## 7. Conventions
Doc-first (update `api-contract.md` before code); one ticket at a time;
deploy-and-curl; PR with review; per-phase e2e scripts in `scripts/`.
