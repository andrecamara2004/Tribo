# Tribo — BETA Foundations Setup

**Goal of this phase:** before anyone writes a single feature, get a thin vertical slice working end-to-end — the Flutter app and React web app both calling a "hello world" endpoint on the Java API, which is deployed to App Engine and connected to Cloud SQL. When that slice works, the foundations are done and Sprint 1 (IAM) can start.

**Locked stack:**
- API: Java REST API on **App Engine Standard**
- Database: **Cloud SQL (PostgreSQL)**
- Media storage: **Cloud Storage**
- Push notifications: **Firebase Cloud Messaging (FCM)**
- Clients: **Flutter** (mobile) + **React** (web)

Do these roughly in order. Each item names a likely owner, but since the team is cross-functional, pair up where it helps.

---

## 1. Source control & collaboration (do this first — everything else lands in the repo)

- [x] Create one **GitHub repository** for the whole project (monorepo: `/api`, `/mobile`, `/web`, `/infra`, `/docs`).
- [x] Decide and write down the **branching strategy**. Recommended for a 5-person team: `main` (protected, always deployable) + short-lived feature branches → pull request → review → merge. Avoid long-lived personal branches.
- [x] Turn on **branch protection** on `main`: require at least 1 PR review, require the build to pass before merge.
- [x] Agree a **commit message convention** (Conventional Commits — `feat:`, `fix:`, `chore:` — is low-effort and keeps history readable).
- [ ] Set up **GitHub Projects** board with columns: Backlog / Sprint / In Progress / In Review / Done.
- [ ] Add a `.gitignore` per subproject (Java/Maven, Flutter, Node) and a root `README.md` that links to this doc.
- [ ] **Never commit secrets.** Add a `.env.example` with empty keys; real `.env` files stay local / in CI secrets.

## 2. Google Cloud project

- [ ] Create a **single GCP project** (e.g. `tribo-beta`). One person owns billing; add the other four as members.
- [ ] Enable the APIs you'll need: App Engine Admin, Cloud SQL Admin, Cloud Storage, and (later) Firebase Cloud Messaging.
- [ ] Set up **IAM roles** for the team — give each member the access they need, not Owner-for-everyone.
- [ ] **Watch the free tier / budget.** Set a billing alert (e.g. €20) so a misconfigured instance doesn't surprise you. Use the smallest Cloud SQL tier (`db-f1-micro`) for development.

## 3. Cloud SQL (PostgreSQL)

- [ ] Create a **PostgreSQL instance** (smallest tier for dev).
- [ ] Create one database (e.g. `tribo`) and a dedicated DB user (not the default admin) for the app.
- [ ] For local development, use the **Cloud SQL Auth Proxy** rather than whitelisting home IP addresses — it's more secure and works the same for everyone on the team.
- [ ] Decide how schema changes are managed. **Use a migration tool (Flyway or Liquibase)** from day one — never hand-edit the production schema. Migrations live in the repo so the schema is reproducible and reviewable.

## 4. Java API skeleton on App Engine

- [ ] Scaffold a **Spring Boot** project (standard, well-documented path with App Engine + Cloud SQL).
- [ ] Add a single health endpoint: `GET /api/health` returning `{"status":"ok"}`. This is your vertical-slice target.
- [ ] Wire up Cloud SQL via JPA/Hibernate using the Cloud SQL socket factory (connects through the App Engine service account — no passwords in code).
- [ ] Add the `app.yaml` for App Engine Standard (Java runtime).
- [ ] **Deploy once now**, manually, to confirm the whole chain works: code → App Engine → reaches Cloud SQL. Don't wait for CI.

## 5. API contract (lock before mobile & web diverge)

- [ ] Agree the **base URL structure and versioning** (`/api/v1/...`).
- [ ] Sketch an **OpenAPI / Swagger** document for the IAM endpoints you'll build in Sprint 1 (register, login, logout, refresh). This is the shared truth both clients code against.
- [ ] Decide and document the **JWT design** up front (it touches every later operation): what claims the token carries (user id, role), access vs. refresh token lifetimes, and how RBAC roles map to claims. The brief is explicit that token design matters — settle it here, not mid-sprint.
- [ ] Agree a **standard error response shape** (e.g. `{ "error": { "code": ..., "message": ... } }`) so both clients handle failures consistently.

## 6. Client scaffolding

- [ ] Scaffold the **Flutter** project; add an HTTP client and call `/api/health`. Confirm a green "ok" on a device/emulator.
- [ ] Scaffold the **React** project (pick the build tool now — Vite is the simple modern default); call `/api/health`. Confirm "ok" in the browser.
- [ ] Put the **API base URL in config**, not hardcoded — both clients will point at localhost during dev and App Engine later.

## 7. CI (lightweight — don't over-build it)

- [ ] Add a **GitHub Actions** workflow that, on each PR, builds the API and runs whatever tests exist (even if just one), and lints the clients. This is what backs your "build must pass before merge" rule.
- [ ] Deployment to App Engine can stay **manual** for BETA — automated deploy is a nice-to-have, not a foundation. Don't sink sprint-zero time into it.

## 8. Shared agreements (write these in `/docs` so they're not just verbal)

- [ ] **Sprint length** — decide 1 or 2 weeks. (2 weeks is usually calmer for a student team balancing other courses.)
- [ ] **Stand-up cadence** — when/how (async in a chat channel is fine if synchronous is hard to schedule).
- [ ] **Definition of Done** — e.g. "merged to main, reviewed, builds green, basic test present."
- [ ] **Pairing / review norms** — since you pitched cross-functional working, make code review mandatory and rotate who reviews so knowledge spreads.

---

## The "foundations are done" test

You're ready to start Sprint 1 when **all of these are true at the same time:**

1. Anyone on the team can clone the repo and run the API locally against Cloud SQL.
2. The deployed App Engine URL returns `{"status":"ok"}` from `/api/health`, and that endpoint reaches the database.
3. Both the Flutter app and the React app successfully display the response from that endpoint.
4. A test PR can be opened, the CI build runs, a teammate reviews it, and it merges to a protected `main`.

Hit those four and you've proven the entire stack connects. Everything after that is feature work on a known-good base.
