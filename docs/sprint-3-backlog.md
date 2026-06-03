# Tribo — Sprint 3 Backlog

**Theme:** Make the approved prototype real. Replace the mock screens (Profile,
Feed, Clan ranking, Volunteer) with real domains, backend-first.
**Status:** Phase 1 in progress.
**Owners:** Whole team. Changes by PR with at least one review.
**Created:** 2026-06-03.

Follows the Sprint 1–2 conventions: one ticket at a time, **update
`docs/api-contract.md` first, then the code**, deploy-and-curl after each card,
no public `/ping-*` probes (SEC-0 lesson).

Ticket prefixes: `D-*` decisions, `B3-*` backend, `W3-*` web, `M3-*` mobile.

---

## 0. Decisions (recorded in `api-contract.md` §6)

- **D-3 Clans** — one clan per user via nullable `clanId` on `User`; any user can
  create/join; join switches; leave clears; no name/tag uniqueness yet.
- **D-4 Runs** — clients post a finished run summary + per-km splits; no server GPS.
- **D-5 Social** — minimal kudos (like/unlike + count) with the feed; comments,
  achievements, goal-progress deferred.
- **D-6 Volunteer events** — extend `Activity` + `Participation.role`, not a new kind.

---

## 1. Phase map (execution order)

```
Phase 1  Identity & Clans      ← DONE (deployed + 26/26 e2e)
Phase 2  Runs                  ← DONE (deployed + 23/23 e2e)
Phase 3  Volunteer events      ← DONE (deployed + 19/19 e2e)
Phase 4  Feed + minimal kudos  ← DONE (deployed + 14/14 e2e)
Phase 5  Clan ranking          ← IN PROGRESS  (aggregate membership + runs + volunteer points)
```

Each phase: doc update first → backend → matching web screen wired to real data
(enable its `web/src/components/Shell.tsx` nav item).

---

## 2. Phase 1 — Identity & Clans

### B3-1 — Clan domain (`com.tribo.api.clan`)
`Clan` record (`id`, `name`, `tag`, `color`, `ownerId`, `createdAt`) +
`ClanRepository` (`save`, `findById`, `list`, `delete`) mirroring
`ActivityRepository`. `ClanRequest` body DTO.
**Done when:** save → findById → list round-trips against Datastore.

### B3-2 — `User.clanId` membership
Add nullable `clanId` to `iam/User.java`; `UserRepository` writes it only when
non-null, reads it legacy-tolerantly, and gains `setClan(userId, clanId)` and
`countByClan(clanId)` (keys-only query). Update existing `new User(...)` sites
(`AuthResource.register`, `UserRepository.markVerified`).
**Done when:** a user can be moved in/out of a clan and counted.

### B3-3 — `GET /rest/users/me`
Full profile read on `UsersResource` (`@Path("/me")`), DB-backed, via a
`MeResponse` DTO that omits `passwordHash` and embeds the resolved clan.
**Done when:** returns the caller's profile with `clan` null or populated.

### B3-4 — `ClanResource` endpoints
`POST /clans` (create + auto-join), `GET /clans`, `GET /clans/{id}`,
`POST /clans/{id}/join`, `POST /clans/leave`. Validation: name non-empty, tag
2–5 chars, color `#RRGGBB`. RBAC: any authenticated user.
**Done when:** create/join/leave reflected in `GET /users/me` and `memberCount`.

### W3-1 — Web identity + Profile
`api/users.ts` (`getMe`), `api/clans.ts`; surface real name/clan in the sidebar
(`Shell.tsx`); add a basic `ProfilePage` (header from `/users/me`, stats left as
empty placeholders until Phase 2); enable the Profile nav item.

---

## 3. Phases 2–5 (summary — detailed when reached)

- **Phase 2 Runs (in progress):** `com.tribo.api.run` (`Run` record with embedded
  per-km splits, `RunRepository`, `RunRequest`, `RunResource`). Endpoints
  `POST /runs`, `GET /runs?scope=me|clan`, `GET /runs/{id}`, `GET /runs/me/last`,
  and `GET /users/me/stats` (weeklyKm[7]/monthKm/monthRuns/avgPaceSecPerKm/streak,
  computed from runs, UTC days). Clients post finished summaries (D-4); listing is
  newest-first, in-memory sorted (no composite index), pagination deferred. Web:
  Tracker page (last run + splits + manual log-run form since mobile run logging
  isn't built yet) + real Profile stats/weekly chart; enable the **Last run** nav.
- **Phase 3 Volunteer events:** extend `Activity` (`eventKind`, `staffCapacity`,
  `pointsParticipant/Staff`, `verifiedBy`, `tags`, `distanceKm`, `hostClanId`),
  `Participation.role`, join-as-role, event verification, roster previews. Web:
  Volunteer screen.
- **Phase 4 Feed + kudos:** `GET /feed?scope=all|clan` aggregating runs +
  volunteer participations; `Kudos` kind + `POST/DELETE /feed/{itemId}/kudos`.
  Web: Feed screen.
- **Phase 5 Clan ranking:** `GET /clans/ranking?metric&period`; `trend` deferred.
  Web: Ranking screen.

---

## 4. Definition of Done (per ticket)
Same as Sprint 2 §8: contract updated first; compiles + deployed + curl'd (happy
+ one error path); RBAC/ownership checked; no `/ping-*` probes; client tickets
verified on the device, not just built.

## 5. Out of scope (carried over)
Email verification, password reset, 2FA, partner profile attributes (NIF), the
`/v1` prefix, comments/achievements/goals (D-5), historical ranking trend.
