# Tribo — API Contract

**Status:** v1, reconciled with the Sprint 1 implementation.
**Owners:** Whole team. Changes by PR with at least one review.
**Last updated:** 2026-06-01.

This document is the shared truth that backend, mobile, and web build against. If the implementation diverges from this doc, update the doc *first*, then change the code. Never the other way around.

> **2026-06-01 reconciliation.** The Sprint 1 IAM endpoints shipped with flatter response bodies than the original draft and a few relaxed validation rules. This doc has been updated to describe **what is actually deployed**. Anything intentionally deferred (token rotation, E.164 phone validation, the `/users/me` endpoint, the `/v1` path prefix) is called out inline so we don't lose the original intent.

---

## 1. Conventions

### Base URL and versioning

All endpoints currently live under `/rest/` (the Jersey servlet is mapped to `/rest/*`).

- Production: `https://tribo-497810.ew.r.appspot.com/rest/...`
- Local dev: `http://localhost:8080/rest/...`

> **Deferred — `/v1` prefix.** The original plan was to ship every route under `/rest/v1/`. Sprint 1 went out without the `v1` segment, so the deployed paths are `/rest/auth/login`, etc. — and the web/mobile clients hard-code base `/rest`. Adding `v1` is now a breaking change for shipped clients; if we want it, do it as a coordinated cut before more endpoints land. Until then, examples below use the real `/rest/...` paths.

Breaking changes will get a version prefix when we introduce versioning. Backward-compatible additions stay on the current paths.

### Request format

All requests with a body send `Content-Type: application/json`. URLs use kebab-case (`/forgot-password`), JSON fields use camelCase (`createdAt`, `phoneNumber`). Required headers on authenticated requests:

```
Authorization: Bearer <accessToken>
```

### Response format — success

All successful responses are JSON. Status codes follow REST conventions:

| Status | When to use |
|--------|-------------|
| `200 OK` | Standard successful response |
| `201 Created` | Resource created (registration, new activity) |
| `204 No Content` | Successful operation, no body (logout, delete) |

### Response format — errors

All errors return this shape, regardless of HTTP status:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect.",
    "details": {}
  }
}
```

- `code` — a stable, uppercase, snake-case identifier. Clients switch on this, not on the message.
- `message` — human-readable, English, suitable for logging. Clients may show it but should prefer their own localized copy keyed off `code`.
- `details` — optional object with extra context. For validation errors: per-field issues.

### HTTP status codes for errors

| Status | Meaning | Example error code |
|--------|---------|--------------------|
| `400 Bad Request` | Malformed request (missing field, invalid JSON) | `VALIDATION_ERROR` |
| `401 Unauthorized` | Missing or invalid token | `INVALID_TOKEN` |
| `403 Forbidden` | Valid token but wrong role | `FORBIDDEN` |
| `404 Not Found` | Resource doesn't exist | `NOT_FOUND` |
| `409 Conflict` | Duplicate (email already registered) | `ALREADY_EXISTS` |
| `429 Too Many Requests` | Rate limit hit | `RATE_LIMITED` |
| `500 Internal Server Error` | Server bug | `INTERNAL_ERROR` |

---

## 2. JWT design

### Token strategy: access + refresh

Two tokens, both signed JWTs, returned together on login and refresh:

- **Access token** — short-lived (**15 minutes**). Sent on every authenticated request via `Authorization: Bearer`. Carries the user's id and role for fast authorization without a DB lookup.
- **Refresh token** — long-lived (**7 days**). Used only to get a new access token. Stored securely by the client.

> **Implementation note — no rotation yet.** `POST /auth/refresh` returns a **new access token only**; the existing refresh token is reused until it expires or is revoked at logout. Refresh-token rotation (a fresh refresh token on every refresh) is still a planned hardening step — see §6.2. The clients are written single-flight-safe so rotation can be switched on backend-side without client changes.

Why two? A stolen access token expires fast. A stolen refresh token can be revoked server-side (we keep a revocation list). Single long-lived tokens fail badly when leaked; this is the standard pattern.

### Signing algorithm: HS256

Symmetric HMAC-SHA256, signed with a server-side secret stored in App Engine environment variables (never in the repo). Simple to implement, well supported by the `com.auth0:java-jwt` library already in the pom.

If we ever need clients to verify tokens without contacting the server (we don't, since clients always talk to our API), switch to RS256.

### Access token claims

```json
{
  "iss": "tribo-api",
  "sub": "user-id-uuid",
  "role": "END_USER",
  "iat": 1717000000,
  "exp": 1717000900,
  "jti": "token-id-uuid"
}
```

- `iss` — issuer, always `"tribo-api"`.
- `sub` — subject, the user's stable id.
- `role` — one of `END_USER`, `ACTIVITY_MANAGER`, `PARTNER`, `BACKOFFICE`, `SYSADMIN` (matches the ADC brief).
- `iat` — issued at, Unix seconds.
- `exp` — expiry, Unix seconds (15 minutes after `iat`).
- `jti` — unique token id, for revocation if needed.

### Refresh token claims

Same shape, with `"typ": "refresh"` added, no `role` (refresh tokens shouldn't authorize anything except the refresh endpoint itself), and `exp` 7 days out.

### Where clients store tokens

- **Web (React):** `httpOnly` cookies if we can serve from the same domain, otherwise `sessionStorage` for access + `localStorage` for refresh. **Never `localStorage` for the access token** — XSS would steal it.
- **Mobile (Flutter):** secure storage via `flutter_secure_storage` (Keychain on iOS, Keystore on Android). Both tokens go here.

### RBAC roles (from the ADC brief)

| Role | What they can do |
|------|------------------|
| `END_USER` | Browse and register for activities |
| `ACTIVITY_MANAGER` | Propose, create, and manage their own activities |
| `PARTNER` | Register events on behalf of an organization |
| `BACKOFFICE` | Verify/authorize activities, manage statistics, regulate accounts |
| `SYSADMIN` | Full platform privileges |

Each endpoint declares which roles can call it. The backend enforces this by reading `role` from the JWT and matching against an allow-list per endpoint.

---

## 3. Sprint 1 endpoints — IAM

The minimum viable IAM surface. Five endpoints, enough to register, log in, stay logged in, and check who's logged in.

### `POST /rest/auth/register`

Creates an account. Does **not** return tokens — the client chains a `POST /auth/login` with the same credentials to obtain a session (both the web and mobile clients do this automatically).

**Request:**

```json
{
  "email": "andre@example.com",
  "password": "P@ssw0rd123",
  "fullName": "André Câmara",
  "phoneNumber": "+351912345678",
  "age": 21,
  "role": "ACTIVITY_MANAGER"
}
```

> **`role` is self-selected but constrained (D-1).** Optional; omit or null → `END_USER`. Only `END_USER`, `ACTIVITY_MANAGER`, and `PARTNER` may be requested. A `BACKOFFICE`/`SYSADMIN` request is rejected `403 FORBIDDEN`; an unknown role is `400 VALIDATION_ERROR`. An `END_USER` is usable immediately; a self-selected `ACTIVITY_MANAGER`/`PARTNER` is created **unverified** (`verified: false`) and cannot act (e.g. create activities) until a backoffice verifies it — see `POST /rest/users/{id}/verify`.

> `profileVisibility` is **ignored on register** — every new account is created `PUBLIC`. Sending it does no harm; it just has no effect. (Settable profile visibility is a later sprint.)

**Response 201:** (`Location: /rest/users/{userId}`)

```json
{
  "userId": "u_8f2c...",
  "email": "andre@example.com",
  "role": "ACTIVITY_MANAGER",
  "verified": false
}
```

**Errors:**

- `400` `VALIDATION_ERROR` — bad email format, weak password, missing required field, unknown role.
- `403` `FORBIDDEN` — requested a non-self-registerable role (`BACKOFFICE`/`SYSADMIN`).
- `409` `ALREADY_EXISTS` — email already registered.

> **Bootstrap admin.** If the server env var `BOOTSTRAP_ADMIN_EMAIL` is set and a registration's email matches it, that account is created as a **verified `SYSADMIN`** (the requested role is ignored). This is the one-time seed so a privileged account exists to verify others; leave the var unset in normal operation. See `docs/sprint-2-backlog.md` §2 (D-1).

**Validation rules (as enforced today):**

- Email: valid format (`x@y.z`), lowercased and trimmed server-side before storage
- Password: **minimum 8 characters** (no complexity rules enforced yet — see note)
- Full name: required, non-empty (trimmed)
- Phone: required, non-empty (trimmed) — **format not validated yet**
- Age: integer in **13–120** inclusive

> **Deferred — stronger validation.** The draft called for a 12-char password with complexity and E.164 phone validation. Sprint 1 ships the relaxed rules above (8-char minimum, non-empty phone). Tightening these is tracked for the hardening pass; do it in the backend `AuthResource` first, then update this section.

Passwords are hashed with **bcrypt** (cost factor 12) before storage. Never stored in plaintext, never logged.

**Authorization:** open (no token required).

---

### `POST /rest/auth/login`

**Request:**

```json
{
  "email": "andre@example.com",
  "password": "P@ssw0rd123"
}
```

**Response 200:** (flat body — tokens and identity together)

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "userId": "u_8f2c...",
  "role": "END_USER",
  "verified": true
}
```

- `expiresIn` — access-token lifetime in seconds (900 = 15 min). The refresh token's lifetime is not echoed; clients treat it as opaque and rely on the refresh call to tell them when it's dead.
- `verified` — whether the account has been cleared to act in its role (D-1). `END_USER` is always `true`; a fresh `ACTIVITY_MANAGER`/`PARTNER` is `false` until a backoffice verifies it. **Advisory only** — it's a UI hint; the backend re-checks verification server-side on each protected action (verification is not carried in the JWT, so a newly-verified user does **not** need to re-login).

**Errors:**

- `401` `INVALID_TOKEN` (message "Invalid email or password.") — wrong email **or** password. **The same error is returned for both** so the response can't be used to enumerate which emails exist.
- `403` `FORBIDDEN` (message "This account has been suspended.") — backoffice has disabled this account.

**Authorization:** open.

---

### `POST /rest/auth/refresh`

Exchanges a valid refresh token for a **new access token**. The refresh token is **not** rotated (see the rotation note in §2) — keep using the same one until it expires or you log out.

**Request:**

```json
{
  "refreshToken": "eyJ..."
}
```

**Response 200:** (access token only — no refresh token in the body)

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Errors:**

- `401` `INVALID_TOKEN` — missing, expired, malformed, **revoked** (logged out), wrong type (an access token sent here), or the user no longer exists.
- `403` `FORBIDDEN` — the account has since been suspended.

**Authorization:** valid refresh token (passed in body, not header — refresh tokens never go in `Authorization`).

---

### `POST /rest/auth/logout`

Revokes the given refresh token (adds its `jti` to the Datastore revocation list) so it can't be used again. Any access token already issued continues to work until it naturally expires (max 15 minutes).

**Request:** the refresh token to revoke, in the body — **not** the `Authorization` header.

```json
{
  "refreshToken": "eyJ..."
}
```

**Response 204:** no body.

**Behavior notes:**

- **Idempotent / forgiving.** If the refresh token is already expired or malformed, logout still returns `204` (it can't be used anyway, so there's nothing to revoke).
- A missing/blank `refreshToken` returns `400` `VALIDATION_ERROR`.
- Sending an *access* token here returns `401` `INVALID_TOKEN` ("Not a refresh token.").

**Authorization:** open endpoint — it authenticates by the refresh token in the body, not by an access-token header.

---

### `GET /rest/ping-auth/whoami`

Returns the identity carried by the access token. The first endpoint clients hit after login (and on app/page reload) to confirm the token works and to populate the UI. Both clients use it as the session-bootstrap probe: a `401` here triggers the refresh-on-401 flow, so a successful `whoami` means the session is live.

**Request:** none.

**Response 200:** (identity only — read straight off the validated JWT, no DB lookup)

```json
{
  "userId": "u_8f2c...",
  "role": "END_USER"
}
```

**Errors:**

- `401` `INVALID_TOKEN` — missing, expired, or malformed access token.

**Authorization:** valid access token, any role.

> **Deferred — full profile `GET /rest/users/me`.** The draft specified a richer profile endpoint (`id`, `email`, `fullName`, `phoneNumber`, `age`, `profileVisibility`, `createdAt`). That isn't built yet; Sprint 1 ships only the lightweight `whoami` probe above. When the full profile endpoint lands it should live at `/rest/users/me` and do a Datastore read; `whoami` can stay as the cheap token-check.

---

## 3.5 Sprint 2 endpoints — Activity Management

The MUST-HAVE after IAM. All activity endpoints require authentication (a valid access token); the JWT carries the caller's id and role, so write operations don't need the client to send either. Role gating uses the same `@AllowedRoles` mechanism as Sprint 1; finer "owner-only" checks are enforced server-side.

### Account verification — `POST /rest/users/{id}/verify`

Backoffice action (D-1): clears a self-registered `ACTIVITY_MANAGER`/`PARTNER` so they can act.

**Request:** empty body.

**Response 200:**

```json
{ "userId": "u_8f2c...", "role": "ACTIVITY_MANAGER", "verified": true }
```

**Errors:** `403` `FORBIDDEN` (caller not `BACKOFFICE`/`SYSADMIN`), `404` `NOT_FOUND` (no such user).

**Authorization:** `@AllowedRoles({BACKOFFICE, SYSADMIN})`. Idempotent — verifying an already-verified user returns `200`.

---

### The Activity resource

```json
{
  "id": "a_1d4f...",
  "ownerId": "u_8f2c...",
  "title": "Sunset trail run",
  "description": "Easy 5k along the coast.",
  "category": "sports",
  "location": "Costa da Caparica",
  "startsAt": "2026-07-01T18:00:00Z",
  "endsAt": "2026-07-01T19:30:00Z",
  "capacity": 20,
  "status": "PUBLISHED",
  "createdAt": "2026-06-01T15:00:00Z",
  "updatedAt": "2026-06-01T15:00:00Z"
}
```

- `ownerId` is set server-side from the JWT on create — never accepted from the body.
- `status` is one of `DRAFT`, `PUBLISHED`, `CANCELLED`. Activities are created **`PUBLISHED`** (immediately discoverable); status changes go through `/cancel`, not `PUT`.
- Timestamps are ISO-8601 UTC instants. An Activity has no secret fields, so it's returned to clients as-is.

### `POST /rest/activities` — create

**Auth:** `@AllowedRoles({ACTIVITY_MANAGER, PARTNER, SYSADMIN})` **and** the caller must be **verified** (privileged roles bypass the verified gate).

**Request:** `title` (required), `startsAt`, `endsAt` (required ISO-8601, `endsAt > startsAt`), `capacity` (required, ≥ 1), `description`, `category`, `location` (optional).

**Response 201** (`Location: /rest/activities/{id}`): the created Activity.

**Errors:** `400` `VALIDATION_ERROR`; `403` `FORBIDDEN` (wrong role) or `403` `ACCOUNT_NOT_VERIFIED` (right role, not yet verified).

### `GET /rest/activities` — list / discover

**Query params:** `status` (default `PUBLISHED`; `ALL` for no filter), `limit` (default 20, max 100), `cursor` (opaque, from a previous page).

**Response 200:**

```json
{ "items": [ { "id": "a_1d4f...", "...": "..." } ], "nextCursor": "Ci0SJ2o...or null" }
```

Pass `nextCursor` back as `cursor` to page; `null` means no more results. **Auth:** any authenticated user.

### `GET /rest/activities/{id}` — detail

**Response 200:** the Activity. `404` `NOT_FOUND` if missing. **Auth:** any authenticated user.

### `PUT /rest/activities/{id}` — edit

Owner-only (or `BACKOFFICE`/`SYSADMIN`). Same body/validation as create. Does **not** change `id`, `ownerId`, `createdAt`, or `status`. **Response 200:** the updated Activity. **Errors:** `400`, `403` `FORBIDDEN` (not owner/privileged), `404` `NOT_FOUND`.

### `POST /rest/activities/{id}/cancel` — cancel

Owner-only soft state change → `status: CANCELLED` (kept so participation history survives; no hard delete in Sprint 2). Idempotent. **Response 200:** the cancelled Activity. **Errors:** `403` `FORBIDDEN`, `404` `NOT_FOUND`.

---

### Participation

A `Participation` is keyed by `(activityId, userId)`, so a user joins an activity at most once.

### `POST /rest/activities/{id}/participants` — join

The caller registers themselves. **Auth:** any authenticated user.

**Response 201:** `{ "activityId": "...", "userId": "...", "joinedAt": "2026-06-01T15:10:00Z" }`

**Errors (all `409 CONFLICT` with distinct codes):**

- `ACTIVITY_NOT_OPEN` — activity isn't `PUBLISHED`.
- `ACTIVITY_STARTED` — `startsAt` is in the past.
- `ALREADY_JOINED` — caller already joined.
- `ACTIVITY_FULL` — at `capacity`.

Plus `404` `NOT_FOUND` if the activity doesn't exist.

> Capacity is checked non-transactionally; a rare race could admit one over capacity. Acceptable at this scale — tighten with a Datastore transaction later if needed.

### `DELETE /rest/activities/{id}/participants/me` — withdraw

The caller removes their own participation. **Idempotent:** withdrawing when not joined still returns `204`. **Response 204:** no body.

### `GET /rest/activities/{id}/participants` — roster

Owner-only (or `BACKOFFICE`/`SYSADMIN`).

**Response 200:**

```json
{ "activityId": "a_1d4f...", "count": 2,
  "participants": [ { "userId": "u_...", "joinedAt": "..." } ] }
```

**Errors:** `403` `FORBIDDEN` (not owner/privileged), `404` `NOT_FOUND`. (Participant info is intentionally minimal for now — `profileVisibility` will gate richer fields when profiles land.)

---

### Sprint 2 error codes (additions to §1's table)

| Status | Code | Meaning |
|--------|------|---------|
| `403` | `ACCOUNT_NOT_VERIFIED` | Right role, but the account isn't backoffice-verified yet |
| `409` | `ACTIVITY_NOT_OPEN` | Join attempt on a non-`PUBLISHED` activity |
| `409` | `ACTIVITY_STARTED` | Join attempt after the activity started |
| `409` | `ALREADY_JOINED` | Join attempt when already a participant |
| `409` | `ACTIVITY_FULL` | Join attempt at capacity |

---

## 3.6 Sprint 3 endpoints — Profiles & Clans

Foundation for the prototype's social screens (Profile, Feed, Clan ranking). This
phase ships the **full user profile read** (deferred since Sprint 1) and the
**Clan** domain (membership, create/join/leave). All endpoints require a valid
access token; gating uses the same mechanisms as Sprints 1–2.

> **Doc-first.** Later Sprint 3 phases (Runs, Volunteer-event extensions, Feed,
> Clan ranking) are tracked in `docs/sprint-3-backlog.md` and will be added to
> this contract as each lands. This section covers Phase 1 only.

### `GET /rest/users/me` — full profile

The richer profile read the Sprint 1 contract deferred (§3, "Deferred — full
profile"). Does a Datastore read (unlike `/ping-auth/whoami`, which only decodes
the JWT). Use `whoami` for the cheap session-bootstrap probe; use `me` to
populate profile/identity UI.

**Request:** none.

**Response 200:** (never includes `passwordHash`)

```json
{
  "userId": "u_8f2c...",
  "email": "ana@example.com",
  "fullName": "Ana Costa",
  "age": 28,
  "role": "ACTIVITY_MANAGER",
  "verified": true,
  "profileVisibility": "PUBLIC",
  "createdAt": "2026-06-01T15:00:00Z",
  "handle": "@ana",
  "avatarColor": "#00B86B",
  "clan": { "id": "c_1a2b...", "name": "Forest Runners", "tag": "FOR", "color": "#00B86B" }
}
```

- `handle` — derived from the email local-part (cosmetic; not unique).
- `avatarColor` — deterministic hex from `userId` (cosmetic).
- `clan` — `null` if the user isn't in a clan.

**Errors:** `401` `INVALID_TOKEN`. **Auth:** any authenticated user.

### The Clan resource

```json
{ "id": "c_1a2b...", "name": "Forest Runners", "tag": "FOR",
  "color": "#00B86B", "ownerId": "u_8f2c...", "createdAt": "2026-06-01T15:00:00Z",
  "memberCount": 12 }
```

- `tag` — short uppercase label, 2–5 chars (e.g. `FOR`).
- `color` — hex string (`#RRGGBB`).
- `memberCount` — derived (count of users whose `clanId` is this clan); present on
  read responses, not stored.
- A user belongs to **at most one** clan (D-3); membership is the `clanId` field
  on the user, not a separate entity.

### `POST /rest/clans` — create

Creates a clan; the **caller auto-joins** as a member and is recorded as `ownerId`.
If the caller was already in a clan, they switch to the new one.

**Request:** `{ "name": "Forest Runners", "tag": "FOR", "color": "#00B86B" }`

**Response 201** (`Location: /rest/clans/{id}`): the created Clan (`memberCount: 1`).

**Errors:** `400` `VALIDATION_ERROR` — name empty, `tag` not 2–5 chars, `color`
not `#RRGGBB`. **Auth:** any authenticated user. (Name/tag uniqueness is **not**
enforced yet — D-3.)

### `GET /rest/clans` — list

**Response 200:** `{ "items": [ { ...clan, "memberCount": N } ] }` (small set; no
paging yet). **Auth:** any authenticated user.

### `GET /rest/clans/{id}` — detail

**Response 200:** the Clan + `memberCount`. `404` `NOT_FOUND` if missing.
**Auth:** any authenticated user.

### `POST /rest/clans/{id}/join` — join

Sets the caller's `clanId` to this clan (switching from any current clan).
Idempotent (joining the same clan twice is a no-op success).

**Response 200:** the joined Clan (with updated `memberCount`). `404` `NOT_FOUND`
if the clan doesn't exist. **Auth:** any authenticated user.

### `POST /rest/clans/leave` — leave

Clears the caller's `clanId`. Idempotent (leaving when not in a clan → `204`).

**Response 204:** no body. **Auth:** any authenticated user.

---

## 3.7 Sprint 3 endpoints — Runs

Runs are the activity log behind the Last-run, Profile-stats, and (later) Feed
screens. Per **D-4**, clients post a *finished* run summary plus per-km splits —
the backend stores and aggregates; there is no server-side GPS. All endpoints
require a valid access token.

### The Run resource

```json
{
  "id": "r_1a2b...",
  "userId": "u_8f2c...",
  "title": "Morning shakeout along the Tagus",
  "location": "Belém, Lisboa",
  "distanceMeters": 8400,
  "durationSeconds": 2301,
  "elevationMeters": 22,
  "routeType": "river",
  "startedAt": "2026-06-03T07:42:00Z",
  "createdAt": "2026-06-03T08:25:00Z",
  "splits": [ { "km": 1, "durationSeconds": 298 }, { "km": 2, "durationSeconds": 292 } ]
}
```

- `userId` — the owner, set server-side from the JWT (never from the body).
- Distances/durations are integers (metres, seconds) — the source of truth;
  clients derive km and pace (`durationSeconds ÷ km`) for display.
- `routeType` — cosmetic label for the route sketch (`river|trail|park|coast|city`);
  free-form, defaults to `river`.
- `splits` — optional per-km entries; `durationSeconds` is the time for that km.

### `POST /rest/runs` — log a run

**Request:** `distanceMeters` (required, > 0), `durationSeconds` (required, > 0),
`startedAt` (required ISO-8601); `title`, `location`, `elevationMeters` (≥ 0),
`routeType`, `splits` (optional).

**Response 201** (`Location: /rest/runs/{id}`): the created Run.
**Errors:** `400` `VALIDATION_ERROR`. **Auth:** any authenticated user.

### `GET /rest/runs` — list

**Query params:** `scope` = `me` (default; the caller's runs) or `clan` (runs by
members of the caller's clan); `limit` (default 50, max 100). Results are newest
first (sorted by `startedAt` descending). Pagination is deferred (small scale).

**Response 200:** `{ "items": [ { ...run } ] }`. **Auth:** any authenticated user.
(`scope=clan` with no clan returns just the caller's own runs.)

### `GET /rest/runs/{id}` — detail

**Response 200:** the Run (with splits). `404` `NOT_FOUND` if missing.
**Auth:** any authenticated user.

### `GET /rest/runs/me/last` — most recent run

The caller's latest run by `startedAt`. **Response 200:** the Run.
`404` `NOT_FOUND` if the caller has logged no runs. **Auth:** any authenticated user.

### `GET /rest/users/me/stats` — derived running stats

Computed on the fly from the caller's runs (UTC day boundaries).

**Response 200:**

```json
{
  "weeklyKm": [6.2, 0, 8.4, 5.1, 12.0, 4.5, 10.3],
  "monthKm": 142.6,
  "monthRuns": 18,
  "avgPaceSecPerKm": 288,
  "streak": 9
}
```

- `weeklyKm` — km per day for the current week, Monday→Sunday (index 0 = Monday).
- `monthKm` / `monthRuns` — totals for the current calendar month.
- `avgPaceSecPerKm` — all-time average pace in seconds per km, or `null` if no runs.
- `streak` — consecutive days with ≥ 1 run, ending today or yesterday.

**Auth:** any authenticated user.

---

## 3.8 Sprint 3 endpoints — Volunteer events

Per **D-6**, the prototype's "volunteer event" is the existing **Activity**
extended with optional volunteer attributes plus a **role** on participation —
not a separate kind. Plain activities are unaffected (the new fields default,
and `eventKind` defaults to `RUN`). No new top-level routes; the existing
`/activities` create/list/detail and `/activities/{id}/participants` endpoints
gain fields and behaviour.

### Activity — added (optional) fields

```json
{
  "...": "(all existing fields)",
  "eventKind": "VOLUNTEER",        // RUN (default) | VOLUNTEER
  "host": "Forest Runners",         // organising entity name (free text)
  "distanceKm": 7.0,
  "verifiedBy": "PEER",             // PEER (default) | PARTNER  — a badge, not per-user attendance
  "staffCapacity": 5,               // staff spots (participant spots = existing `capacity`)
  "pointsParticipant": 100,
  "pointsStaff": 110,
  "tags": ["river", "easy"]
}
```

On **read** (`GET /activities` and `GET /activities/{id}`) the response also
carries derived, non-sensitive counts (it never lists participant identities):

```json
{ "...": "(activity fields)",
  "participantsJoined": 14, "staffJoined": 4,
  "userRole": "PARTICIPANT" }   // the caller's role on this activity, or null
```

`POST`/`PUT /activities` accept the added fields (all optional; defaults as
above). `eventKind`/`verifiedBy` are validated against their enums; numeric
fields must be ≥ 0. Auth/ownership rules are unchanged.

### Participation — role

A `Participation` now carries a `role`: `PARTICIPANT` (default) or `STAFF`.

### `POST /rest/activities/{id}/participants?role=participant|staff`

`role` query param (default `participant`). Existing checks (`ACTIVITY_NOT_OPEN`,
`ACTIVITY_STARTED`, `ALREADY_JOINED`) still apply. Capacity is now per role:
participants against `capacity`, staff against `staffCapacity`.

**Response 201:** `{ "activityId", "userId", "joinedAt", "role" }`.

**Added error codes:**

| Status | Code | Meaning |
|--------|------|---------|
| `409` | `STAFF_FULL` | Staff spots are full |
| `409` | `NOT_A_VOLUNTEER_EVENT` | `role=staff` on a non-volunteer event (or one with no staff spots) |
| `403` | `NOT_STAFF_ELIGIBLE` | Caller hasn't joined ≥ 3 volunteer events yet |
| `409` | `ACTIVITY_FULL` | Participant spots full (existing code, now role-scoped) |

The roster (`GET /activities/{id}/participants`, owner-only) now includes each
participant's `role`.

### `GET /rest/users/me` — added fields

Profile now also reports volunteer standing:

```json
{ "...": "(profile fields)", "volunteerEvents": 4, "staffEligible": true }
```

- `volunteerEvents` — number of `VOLUNTEER`-kind activities the caller has joined.
- `staffEligible` — `true` once `volunteerEvents ≥ 3` (the threshold to join as staff).

> **Deferred:** actual attendance verification and volunteer-**points**
> accumulation to users/clans are not in this phase — events advertise points and
> a `verifiedBy` badge, but points aren't yet credited. That lands with the Feed /
> ranking work (Phase 4–5). Roster avatar *previews* (named) remain owner-only for
> privacy; cards show counts only.

---

## 3.9 Sprint 3 endpoints — Feed + kudos

The activity feed aggregates recent **runs** and **volunteer-event joins** into a
single, newest-first timeline, with denormalised author info. Plus **minimal
kudos** (like/unlike + count) per **D-5** — comments are deferred.

### `GET /rest/feed`

**Query params:** `scope` = `all` (default; everyone) or `clan` (members of the
caller's clan only; falls back to the caller alone if they're in no clan);
`limit` (default 30, max 100).

**Response 200:** `{ "items": [ FeedItem, … ] }`, newest first by `when`.

A **FeedItem** is one of two shapes sharing a common head:

```jsonc
{
  "id": "r_…",                 // run id, or "{activityId}:{userId}" for a volunteer join
  "type": "run",               // "run" | "volunteer"
  "when": "2026-06-03T07:42:00Z",
  "author": { "userId": "u_…", "name": "Ana Costa", "clanName": "Forest Runners", "color": "#00B86B" },
  "title": "Morning shakeout",
  "location": "Belém",
  "kudosCount": 3,
  "likedByMe": false,
  "commentCount": 0,           // always 0 for now (comments deferred)

  // type=run only:
  "distanceKm": 8.4, "durationSeconds": 2301, "paceSecPerKm": 274,
  "elevationMeters": 22, "routeType": "river",

  // type=volunteer only:
  "role": "PARTICIPANT", "pointsEarned": 100, "verifiedBy": "PARTNER", "distanceKm": 7.0
}
```

`author.color` is the author's clan colour, or their deterministic avatar colour
if they're in no clan (matches `GET /users/me` `avatarColor`). **Auth:** any
authenticated user.

> Aggregation is computed per request (no stored timeline) and sorted in memory —
> fine at this scale. Volunteer **points** shown as `pointsEarned` are the event's
> advertised value; they are still not credited to user/clan totals (deferred).

### `POST /rest/feed/{itemId}/kudos` — like

Idempotent (liking twice is a no-op). **Response 200:**
`{ "itemId": "…", "kudosCount": 4, "likedByMe": true }`. **Auth:** any authenticated user.

### `DELETE /rest/feed/{itemId}/kudos` — unlike

Idempotent (unliking when not liked still succeeds). **Response 204.**
**Auth:** any authenticated user.

> Kudos are stored as their own kind keyed `{itemId}:{userId}` (one like per user
> per item). `itemId` is opaque to the client — pass back exactly what the feed
> item carried. Comments are **deferred** (D-5).

---

## 3.10 Sprint 3 endpoints — Clan ranking

The clan leaderboard, computed on the fly from clan membership + member runs +
member volunteer joins. Closes out the prototype's screens.

### `GET /rest/clans/ranking`

**Query params:** `metric` = `avgPace` (default) | `distance` | `consistency` |
`impact`; `period` = `all` (default) | `month` | `week` (affects the distance
metric's value/sort).

**Response 200:**

```json
{
  "metric": "avgPace",
  "period": "all",
  "updatedAt": "2026-06-03T15:00:00Z",
  "clans": [
    {
      "rank": 1, "id": "c_…", "name": "Forest Runners", "tag": "FOR", "color": "#00B86B",
      "members": 12,
      "totalKm": 3247.4, "monthlyKm": 1420.5, "weeklyKm": 412.0,
      "avgPaceSecPerKm": 282,
      "consistencyPct": 95,
      "volunteerPoints": 8620, "volunteerEvents": 86,
      "trend": "flat"
    }
  ]
}
```

- **avgPace** — total member run duration ÷ total distance (all-time); `null` if
  no runs. Sorted ascending (faster = better).
- **distance** — `weeklyKm` / `monthlyKm` / `totalKm` per `period`; sorted descending.
- **consistency** — `consistencyPct` = share of members with ≥ 1 run this week;
  sorted descending.
- **impact** — `volunteerPoints` = sum over members' volunteer joins of the event's
  participant/staff points; sorted descending.
- `trend` is always `"flat"` for now — historical snapshots aren't stored yet
  (deferred), so week-over-week movement can't be computed.

**Auth:** any authenticated user.

> Like the feed, this scans members' runs/participations per request (no stored
> rollup) and ranks in memory — fine at this scale; revisit with periodic
> aggregation if clan/run counts grow. Volunteer points here are computed for the
> leaderboard but still not credited to per-user totals.

---

## 3.11 Sprint 3.5 (Phase 6) — points, achievements, goals, comments, trend

Closes the previously-deferred prototype features. All computed from existing
data where possible (no new stored counters), consistent with the rest of the API.

### `GET /rest/users/me` — added fields

```json
{
  "...": "(existing profile fields)",
  "volunteerPoints": 320,        // sum over the user's volunteer joins of the event's participant/staff points
  "weeklyGoalKm": 20.0,          // per-user weekly distance goal (0 = none)
  "achievements": [              // earned badges, derived from runs + volunteering
    { "icon": "🏅", "title": "Sub-5 pace", "sub": "Avg pace under 5:00/km" }
  ]
}
```

Volunteer points are now **credited** as a real total (still derived per request,
not a stored counter). Achievement rules (earned when true): Sub-5 pace
(all-time avg < 5:00/km), Century Month (≥100 km this month), On Fire (streak ≥3),
Eco Runner (≥3 volunteer events), Trusted Staff (staff-eligible).

### `PUT /rest/users/me/goal` — set weekly distance goal

**Request:** `{ "weeklyGoalKm": 20 }` (≥ 0; 0 clears). **Response 200:** the updated
profile (same shape as `GET /users/me`). **Auth:** any authenticated user.

### Comments (replaces the deferred `commentCount: 0`)

- `GET /rest/feed/{itemId}/comments` → `{ "items": [ { "id","text","createdAt","author":{userId,name,color} } ] }`, oldest first.
- `POST /rest/feed/{itemId}/comments` `{ "text": "…" }` → `201` the created comment. `400` if text is blank.
- `DELETE /rest/feed/{itemId}/comments/{commentId}` → `204`. Author or privileged (BACKOFFICE/SYSADMIN) only, else `403`; `404` if missing.

Feed items now report a real `commentCount`. **Auth:** any authenticated user.

### Clan ranking — `trend` is now real

`GET /clans/ranking` rows carry `trend` = `up` | `down` | `flat`, comparing each
clan's current rank to its rank in the **previous ISO week** for the same
`metric`+`period`. The endpoint records a weekly rank snapshot per clan as a side
effect, so trend becomes meaningful once two distinct weeks have been observed
(until then, `flat`).

---

## 4. Things deliberately deferred

These are real concerns but out of scope for Sprint 1. Don't let them block IAM:

- **Email verification.** Sprint 1 accepts any well-formed email. Verification flow comes in Sprint 2.
- **Password reset.** Sprint 2.
- **Two-factor authentication.** The ADC brief mentions "double verification" — that lands in a later sprint.
- **Partner and SysAdmin registration.** Sprint 1 only registers `END_USER`. Other roles are created through a separate (later) flow or seeded directly.
- **Profile attributes for partners.** NIF, institutional address etc. — partner registration is a separate sprint.

---

## 5. Implementation checklist (Sprint 1)

For the team, mapping endpoints to workstreams:

**Backend (whoever picks it up):**

- [x] `User` kind in Datastore with attributes from the brief
- [x] bcrypt hashing on register, comparison on login (`org.mindrot:jbcrypt`)
- [x] JWT issuance helper (`com.auth0:java-jwt` — already in pom)
- [x] JWT validation filter (Jersey `ContainerRequestFilter`) that runs before resource methods
- [x] `@AllowedRoles` mechanism so each endpoint can declare its allowed roles (RBAC via `RolesDynamicFeature`)
- [x] Revocation list for refresh tokens (Datastore `RevokedToken` kind, expires-cleanup task can wait)
- [x] The endpoints above
- [x] Standard error response (a JAX-RS `ExceptionMapper`)

**Mobile (Flutter):**

- [x] Registration screen
- [x] Login screen
- [x] Token storage via `flutter_secure_storage`
- [x] HTTP client wrapper that attaches `Authorization` automatically
- [x] HTTP interceptor that catches `401`, tries the refresh endpoint, retries the original request (single-flight)
- [x] Logout screen / action

**Web (React):**

- [x] Same screens / behaviors
- [x] Same automatic refresh-on-401 pattern (single-flight)
- [x] Token storage per the rules in §2

---

## 6. Open questions for the team meeting

Things this draft picked a side on. If the team disagrees, change the doc:

1. **Access token lifetime — 15 minutes.** Some teams go 1 hour. Trade-off: shorter = more refresh calls but smaller stolen-token window. **Shipped: 15 minutes** (`expiresIn: 900`).
2. **Refresh token rotation.** The draft wanted yes — each refresh call returns a *new* refresh token, which lets us detect a stolen refresh token (if the old one is used again after rotation, both sessions are invalidated). **Shipped: NOT yet** — `/auth/refresh` returns only a new access token and the refresh token is reused until expiry/logout (see §2). Rotation remains the planned hardening step; the clients are already single-flight-safe for it.
3. **Password rules.** The brief says "strong password requirements." The draft proposed 12 chars + complexity. **Shipped: minimum 8 characters, no complexity rules** (see §3 register). **Decision (D-2, 2026-06-01): keep 8 chars for now** — revisit as a standalone hardening ticket; not blocking Sprint 2.
4. **Role assignment.** **Decision (D-1, 2026-06-01): self-select at registration with backoffice verification.** A user picks `ACTIVITY_MANAGER`/`PARTNER` at register; the account is created **unverified** and can't act until a backoffice clears it via `POST /rest/users/{id}/verify`. `BACKOFFICE`/`SYSADMIN` are never self-registerable. The first privileged account is seeded via the `BOOTSTRAP_ADMIN_EMAIL` env var (see §3 register). Implemented in Sprint 2 — see §3.5 and `docs/sprint-2-backlog.md`.

5. **Clan membership model (D-3, 2026-06-03).** A user belongs to **at most one clan**, stored as a nullable `clanId` on the user (not a separate membership entity). Any authenticated user may create or join a clan; joining switches clans; leaving clears it. Clan name/tag uniqueness is **not** enforced yet. Implemented in Sprint 3 Phase 1 — see §3.6 and `docs/sprint-3-backlog.md`.
6. **Run ingestion (D-4, 2026-06-03).** Clients post a *finished* run summary (distance, duration, pace, elevation, route type) plus per-km splits; there is **no server-side GPS ingestion**. Live tracking is a client concern (the Flutter app). Sprint 3 Phase 2.
7. **Social features (D-5, 2026-06-03).** The feed ships with **minimal kudos** (like/unlike + count). **Comments, achievements, and goal-progress are deferred** — the prototype shows them, but they are out of scope until a later sprint. Sprint 3 Phase 4.
8. **Volunteer events (D-6, 2026-06-03).** The prototype's richer "volunteer event" is modelled by **extending the existing `Activity`** (optional `eventKind`, staff capacity, points, `verifiedBy`, tags) plus a `role` (STAFF/PARTICIPANT) on `Participation` — not a separate kind. Sprint 3 Phase 3.