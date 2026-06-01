# Tribo — Sprint 2 Backlog

**Theme:** Activity Management (the MUST-HAVE after IAM, per the ADC brief) + close out Sprint 1 security debt.
**Status:** Draft, pending team review.
**Owners:** Whole team. Changes by PR with at least one review.
**Created:** 2026-06-01.

This backlog follows the Sprint 1 conventions: one ticket at a time, deploy-and-curl after each card, and **update `docs/api-contract.md` first, then the code** for anything that touches the HTTP surface.

Ticket prefixes: `SEC-*` security, `D-*` decisions, `B2-*` backend, `M2-*` mobile, `W2-*` web.

---

## 0. Phase map (execution order)

```
Phase 0  Security close-out         SEC-0 ✅ · SEC-1 · D-1 · D-2
            │  (must land before new endpoints sit on top of IAM)
            ▼
Phase 1  Activity domain            B2-1 · B2-2
            │  (model + repo + ownership mechanism — no HTTP yet)
            ▼
Phase 2  Write endpoints            B2-3 (create) · B2-4 (edit) · B2-5 (cancel)
            │
            ▼
Phase 3  Discovery / read           B2-6 (list) · B2-7 (detail)
            │
            ▼
Phase 4  Participation              B2-8 (join) · B2-9 (withdraw) · B2-10 (roster)
            │
            ▼
Phase 5  Clients                    M2-1..M2-3 (mobile) · W2-1..W2-3 (web)
```

Backend phases 1–4 are sequential (each card builds on the last). Clients (Phase 5) can start once the read + write endpoints (Phases 2–3) are deployed.

---

## 1. Phase 0 — Security close-out (Sprint 1 debt)

These are not features; they're the cost of having shipped IAM with temporary scaffolding. **Do them before Activity Management** so new RBAC-gated endpoints aren't built on top of an open bypass.

### SEC-0 — Remove temporary probes ✅ *(done 2026-06-01)*

Deleted in this session:

- `PingUserResource` (`/rest/ping-user`, `/rest/ping-user/mint-token`) — **critical**: `mint-token` was `@PublicEndpoint` and issued a valid access token for **any role including `SYSADMIN`** with no auth. A full RBAC bypass live in production. Gone.
- `PingDbResource` (`/rest/ping-db`) — foundations Datastore probe, marked "remove before BETA."
- `PingAuthResource./admin-only` — dead RBAC test endpoint. **`/whoami` was kept** — the contract and both clients depend on it as the session-bootstrap probe.

**Done when:** ✅ files removed, API compiles, no references remain (`grep` clean), deployed.

### SEC-1 — Move `JWT_SECRET` to Secret Manager (+ rotate at cutover)

**Why:** The secret is configured via `env-variables` in `appengine-web.xml`, which is committed. Anything committed there lives in git history forever — so the value is compromised by definition, and with the HS256 key anyone with repo access can forge a `SYSADMIN` token offline. An interim rotation landed with SEC-0 (the previously-leaked string no longer signs valid tokens), but the new value is *still* committed. This ticket is the real fix.

**Scope:**

1. Create the secret in Google Secret Manager (`gcloud secrets create tribo-jwt-secret`), generate a **fresh** value at this point (don't reuse the interim one — rotate again at cutover).
2. Grant the App Engine default service account `roles/secretmanager.secretAccessor`.
3. Add `com.google.cloud:google-cloud-secretmanager` to `api/pom.xml`.
4. In `JwtIssuer.initIfNeeded()`, resolve the secret in this order: Secret Manager → `JWT_SECRET` env var (local-dev fallback) → fail-fast. (It already fails-fast with no insecure default — keep that.)
5. Remove the `JWT_SECRET` value from `appengine-web.xml`. Keep only non-secret config (`JWT_ISSUER`) there.
6. Document local-dev setup (set `JWT_SECRET` env var or point at the emulator) in `api/README.md`.

> Requires GCP project access (gcloud auth) — a human runs steps 1–2. Steps 3–6 are code/PR.

**Done when:** prod issues/verifies tokens using the Secret-Manager value, `appengine-web.xml` contains no secret, the interim value is rotated out, and a forged token signed with any previously-committed secret is rejected.

**Note on history:** rotation neutralizes the leaked values going forward. Scrubbing them from git history (filter-repo / BFG) is optional and disruptive; for a course project, rotation is sufficient. Decide as a team.

---

## 2. Decisions to settle first (block Phase 2)

Two open questions from `api-contract.md` §6 gate Activity Management. Settle them before the create/edit endpoints, because they change the endpoints' shape and authorization.

### D-1 — How does someone become an `ACTIVITY_MANAGER`? *(blocks B2-3)*

Today self-registration only creates `END_USER`. `POST /activities` must be restricted to `ACTIVITY_MANAGER` / `PARTNER`, so we need a path to *get* those roles. Options:

- **(a) Backoffice promotion** — `END_USER` applies; a `BACKOFFICE`/`SYSADMIN` upgrades their role via an admin endpoint. Cleanest authorization story; matches the brief's "regulate accounts." **Recommended.**
- **(b) Self-select at registration** — register chooses a role, account starts unverified, backoffice verifies before it can act. More flow, earlier.
- **(c) Seed-only** — managers seeded directly for now, real flow deferred. Fastest, but blocks any end-to-end demo of manager features by non-seeded users.

**Deliverable:** a decision recorded here + in §6.4 of the contract. If (a)/(b), a small ticket for the promotion/verification endpoint (`PATCH /rest/users/{id}/role`, `@AllowedRoles({BACKOFFICE, SYSADMIN})`).

### D-2 — Tighten password rules now, or defer? *(touches register)*

Shipped rule is **8 chars, no complexity** (relaxed from the drafted 12+complexity). Decide between keeping 8, going 12+complexity, or NIST-style 14-no-complexity. If we change it, do `AuthResource` validation first, then update §3 + §6.3 of the contract. Low effort; settle it so it's not litigated per-PR.

---

## 3. Phase 1 — Activity domain foundations

### B2-1 — `Activity` entity, enums, and `ActivityRepository`

Follow the `User` / `UserRepository` pattern exactly (Datastore kind, UUID string key, record-style entity, repository wrapping `Datastore`).

- **`Activity`** fields (first cut, refine against the brief): `id` (UUID), `ownerId` (creator's user id), `title`, `description`, `category`/`type` (enum), `location`, `startsAt`/`endsAt` (Instant), `capacity` (int), `status` (enum: `DRAFT`, `PUBLISHED`, `CANCELLED`), `createdAt`, `updatedAt`.
- **`ActivityStatus`** enum.
- **`ActivityRepository`**: `save`, `findById`, `delete`, and a `list(...)` that supports the discovery query in B2-6 (filter by status, simple paging).

**Done when:** a repository round-trip (save → findById → list) works against Datastore. *(Test it with a throwaway local check or a unit test — do NOT add a public `/ping-*` probe; that's the mistake SEC-0 just cleaned up.)*

### B2-2 — Ownership-check mechanism (owner-or-privileged)

New territory beyond `@AllowedRoles`: `PUT/DELETE /activities/{id}` must be allowed for **the owner** *or* a privileged role (`BACKOFFICE`/`SYSADMIN`), not for every `ACTIVITY_MANAGER`. Build a small reusable helper that reads the `AuthenticatedUser` (from `JwtAuthFilter`'s `tribo.user` property) and the target resource's `ownerId`, and throws `ForbiddenException` when neither owner nor privileged.

- Keep it explicit and testable (a helper called inside resource methods) rather than over-engineering an annotation framework now. Revisit an `@OwnerOnly` abstraction if a third endpoint needs it.

**Done when:** owner passes, non-owner `ACTIVITY_MANAGER` gets `403 FORBIDDEN`, `SYSADMIN` passes.

---

## 4. Phase 2 — Activity write endpoints

> Update `api-contract.md` first for each of these (request/response/errors/authorization), then implement.

### B2-3 — `POST /rest/activities` (create)

- **Auth:** `@AllowedRoles({ACTIVITY_MANAGER, PARTNER, SYSADMIN})` — the RBAC plumbing (`RolesDynamicFeature`) already supports this.
- Sets `ownerId` = caller's id (from the JWT, never trust a body field), `status` = `DRAFT` (or `PUBLISHED` — decide), timestamps server-side.
- Validates required fields, `endsAt > startsAt`, `capacity >= 1`. Reuse `ValidationException`.
- **Response 201** with `Location: /rest/activities/{id}` and the created activity.

### B2-4 — `PUT /rest/activities/{id}` (owner-only edit)

- **Auth:** authenticated + **B2-2 ownership check**.
- Updatable fields only (not `id`, `ownerId`, `createdAt`). `404 NOT_FOUND` if missing; `403 FORBIDDEN` if not owner/privileged.

### B2-5 — Cancel / status change *(optional this sprint)*

- `POST /rest/activities/{id}/cancel` (or `PATCH .../status`) → `CANCELLED`. Owner-only. Prefer a soft status change over hard `DELETE` so participation history survives. Defer hard delete.

---

## 5. Phase 3 — Discovery / read

### B2-6 — `GET /rest/activities` (catalog)

- Lists `PUBLISHED` activities. Support basic filtering (status, maybe category/date) and simple pagination (limit + cursor) — keep it minimal.
- **Auth:** decide open vs. authenticated. `END_USER` browsing is core, so likely **authenticated, any role** (or open read). Record the choice.

### B2-7 — `GET /rest/activities/{id}` (detail)

- Single activity by id. `404 NOT_FOUND` if missing. Auth same as B2-6.

---

## 6. Phase 4 — Participation

### B2-8 — `POST /rest/activities/{id}/participants` (join)

- **Auth:** authenticated `END_USER` (and others?). Registers the caller for the activity.
- Enforce: activity is `PUBLISHED`, not full (`capacity`), not already joined, not past `startsAt`. New error code(s) as needed (e.g. `ACTIVITY_FULL`, `ALREADY_JOINED`) — add to the contract's error table.
- Storage: decide between a `Participation` kind (its own entity — recommended, scales and carries join time/status) vs. an embedded list on `Activity` (simpler, contention-prone). **Recommend a `Participation` kind.**

### B2-9 — `DELETE /rest/activities/{id}/participants/me` (withdraw)

- Caller removes their own participation. Idempotent-ish (withdrawing when not joined → `404` or `204`, pick one and document).

### B2-10 — `GET /rest/activities/{id}/participants` (roster)

- **Auth:** owner of the activity or privileged role (B2-2). Lists participants. Mind privacy (`profileVisibility`) when exposing participant info.

---

## 7. Phase 5 — Clients

Mirror the Sprint 1 client architecture so web and mobile stay in sync (shared `apiFetch`/`ApiClient`, the same screens). Reuse the existing auth interceptor — these are just new authenticated calls.

**Mobile (Flutter):**

- **M2-1** — Activity list + detail screens (browse the catalog, view one).
- **M2-2** — Create / edit activity (manager/partner only; gate UI on `role`).
- **M2-3** — Join / withdraw participation from the detail screen.

**Web (React):**

- **W2-1** — Activity list + detail pages.
- **W2-2** — Create / edit activity (role-gated route, like `ProtectedRoute`).
- **W2-3** — Join / withdraw participation.

**Done when:** an `ACTIVITY_MANAGER` can create an activity and an `END_USER` can discover and join it, on both clients, end-to-end against the deployed API.

---

## 8. Definition of Done (per ticket)

1. `api-contract.md` updated **first** for any HTTP-surface change.
2. Code compiles; backend deployed; endpoint curl'd (happy path + at least one error path).
3. RBAC/ownership verified with a wrong-role / non-owner call returning the right `403`.
4. No new public `/ping-*` style probes left behind (SEC-0 lesson).
5. Client tickets: verified on the relevant device/emulator, not just unit-built.

---

## 9. Out of scope for Sprint 2

Deferred to keep the sprint focused (revisit per the brief's roadmap):

- Email verification, password reset, 2FA (still deferred from Sprint 1).
- Partner-specific profile attributes (NIF, institutional address).
- `GET /rest/users/me` full profile (clients keep using `/ping-auth/whoami` until it lands).
- Statistics / backoffice dashboards, activity recommendations, ratings.
- The `/v1` path prefix migration (see `api-contract.md` §1).
