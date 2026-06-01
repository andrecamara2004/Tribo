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

Creates an `END_USER` account. Does **not** return tokens — the client chains a `POST /auth/login` with the same credentials to obtain a session (both the web and mobile clients do this automatically).

**Request:**

```json
{
  "email": "andre@example.com",
  "password": "P@ssw0rd123",
  "fullName": "André Câmara",
  "phoneNumber": "+351912345678",
  "age": 21
}
```

> `profileVisibility` is **ignored on register** — every new account is created `PUBLIC`. Sending it does no harm; it just has no effect. (Settable profile visibility is a later sprint.)

**Response 201:** (`Location: /rest/users/{userId}`)

```json
{
  "userId": "u_8f2c...",
  "email": "andre@example.com",
  "role": "END_USER"
}
```

**Errors:**

- `400` `VALIDATION_ERROR` — bad email format, weak password, missing required field.
- `409` `ALREADY_EXISTS` — email already registered.

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
  "role": "END_USER"
}
```

- `expiresIn` — access-token lifetime in seconds (900 = 15 min). The refresh token's lifetime is not echoed; clients treat it as opaque and rely on the refresh call to tell them when it's dead.

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
3. **Password rules.** The brief says "strong password requirements." The draft proposed 12 chars + complexity. **Shipped: minimum 8 characters, no complexity rules** (see §3 register). Tightening this is open — decide between 12+complexity and the NIST-2024-style 14-chars-no-complexity before we call IAM hardened.
4. **Role assignment.** This draft assigns `END_USER` on self-registration. **Shipped: `END_USER` only.** Activity managers and partners need a separate path — decide whether they self-register and are upgraded, or apply through a form.