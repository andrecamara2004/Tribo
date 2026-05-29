# Tribo — API Contract

**Status:** Draft v1, pending team review.
**Owners:** Whole team. Changes by PR with at least one review.
**Last updated:** 2026-05-29.

This document is the shared truth that backend, mobile, and web build against. If the implementation diverges from this doc, update the doc *first*, then change the code. Never the other way around.

---

## 1. Conventions

### Base URL and versioning

All endpoints live under `/rest/v1/`. Adding `v1` now is cheap; retrofitting it later (after mobile and web have shipped) is painful.

- Production: `https://tribo-497810.ew.r.appspot.com/rest/v1/...`
- Local dev: `http://localhost:8080/rest/v1/...`

Breaking changes get a new version prefix (`/rest/v2/...`). Backward-compatible additions stay in `v1`.

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

### `POST /rest/v1/auth/register`

Creates an `END_USER` account. Returns both tokens so the user is logged in immediately after registering.

**Request:**

```json
{
  "email": "andre@example.com",
  "password": "P@ssw0rd-with-15-chars",
  "fullName": "André Câmara",
  "phoneNumber": "+351912345678",
  "age": 21,
  "profileVisibility": "PUBLIC"
}
```

**Response 201:**

```json
{
  "user": {
    "id": "u_8f2c...",
    "email": "andre@example.com",
    "fullName": "André Câmara",
    "role": "END_USER",
    "profileVisibility": "PUBLIC"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "accessTokenExpiresIn": 900,
    "refreshTokenExpiresIn": 604800
  }
}
```

**Errors:**

- `400` `VALIDATION_ERROR` — bad email format, weak password, missing required field. `details` lists per-field issues.
- `409` `ALREADY_EXISTS` — email already registered.

**Validation rules:**

- Email: valid format, lowercased server-side before storage
- Password: minimum 12 characters, at least one digit, one uppercase, one lowercase, one symbol
- Phone: E.164 international format (`+351...`)
- Age: integer ≥ 13
- ProfileVisibility: `"PUBLIC"` or `"PRIVATE"`

Passwords are hashed with **bcrypt** (cost factor 12) before storage. Never stored in plaintext, never logged.

**Authorization:** open (no token required).

---

### `POST /rest/v1/auth/login`

**Request:**

```json
{
  "email": "andre@example.com",
  "password": "P@ssw0rd-with-15-chars"
}
```

**Response 200:**

```json
{
  "user": {
    "id": "u_8f2c...",
    "email": "andre@example.com",
    "fullName": "André Câmara",
    "role": "END_USER"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "accessTokenExpiresIn": 900,
    "refreshTokenExpiresIn": 604800
  }
}
```

**Errors:**

- `401` `INVALID_CREDENTIALS` — wrong email or password. **Return the same error for both** (don't leak which one was wrong — that's an account-enumeration vector).
- `403` `ACCOUNT_SUSPENDED` — backoffice has disabled this account.

**Authorization:** open.

---

### `POST /rest/v1/auth/refresh`

Exchanges a valid refresh token for a new access token (and optionally a new refresh token — token rotation).

**Request:**

```json
{
  "refreshToken": "eyJ..."
}
```

**Response 200:**

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

**Errors:**

- `401` `INVALID_TOKEN` — expired, malformed, or revoked refresh token.

**Authorization:** valid refresh token (passed in body, not header — refresh tokens never go in `Authorization`).

---

### `POST /rest/v1/auth/logout`

Revokes the current refresh token so it can't be used again. The access token continues to work until it naturally expires (max 15 minutes).

**Request:** empty body.

**Response 204:** no body.

**Errors:**

- `401` `INVALID_TOKEN` — missing or expired access token.

**Authorization:** valid access token in `Authorization: Bearer ...`.

---

### `GET /rest/v1/users/me`

Returns the current user's profile. The first endpoint clients hit after login to confirm the token works and to populate the UI.

**Request:** none.

**Response 200:**

```json
{
  "id": "u_8f2c...",
  "email": "andre@example.com",
  "fullName": "André Câmara",
  "phoneNumber": "+351912345678",
  "age": 21,
  "role": "END_USER",
  "profileVisibility": "PUBLIC",
  "createdAt": "2026-05-29T11:32:02Z"
}
```

**Errors:**

- `401` `INVALID_TOKEN` — missing or expired access token.

**Authorization:** valid access token, any role.

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

- [ ] `User` kind in Datastore with attributes from the brief
- [ ] bcrypt hashing on register, comparison on login (`org.mindrot:jbcrypt`)
- [ ] JWT issuance helper (`com.auth0:java-jwt` — already in pom)
- [ ] JWT validation filter (Jersey `ContainerRequestFilter`) that runs before resource methods
- [ ] `@RolesAllowed`-style mechanism so each endpoint can declare its allowed roles
- [ ] Revocation list for refresh tokens (Datastore `RevokedToken` kind, expires-cleanup task can wait)
- [ ] The five endpoints above
- [ ] Standard error response (a JAX-RS `ExceptionMapper`)

**Mobile (Flutter):**

- [ ] Registration screen
- [ ] Login screen
- [ ] Token storage via `flutter_secure_storage`
- [ ] HTTP client wrapper that attaches `Authorization` automatically
- [ ] HTTP interceptor that catches `401`, tries the refresh endpoint, retries the original request
- [ ] Logout screen / action

**Web (React):**

- [ ] Same five screens / behaviors
- [ ] Same automatic refresh-on-401 pattern
- [ ] Token storage per the rules in §2

---

## 6. Open questions for the team meeting

Things this draft picked a side on. If the team disagrees, change the doc:

1. **Access token lifetime — 15 minutes.** Some teams go 1 hour. Trade-off: shorter = more refresh calls but smaller stolen-token window.
2. **Refresh token rotation.** This draft says yes — each refresh call returns a *new* refresh token. Costs a bit of extra logic, gains the ability to detect a stolen refresh token (if the old one is used again after rotation, both sessions are invalidated).
3. **Password rules — minimum 12 characters with complexity.** The brief says "strong password requirements." 12 chars + complexity is one interpretation; 14 chars with no complexity rules (NIST 2024 guidance) is another.
4. **Role assignment.** This draft assigns `END_USER` on self-registration. Activity managers and partners need a separate path — decide whether they self-register and are upgraded, or apply through a form.