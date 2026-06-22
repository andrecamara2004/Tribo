# Tribo — Working Agreements

Written down so they're real, not just verbal. Update by PR if the team agrees to change something.

## Branching

- `main` is **protected** and always deployable. Never push directly to it.
- Work happens on **short-lived feature branches** off `main`, named `type/short-description`:
  - `feat/iam-register`, `fix/login-token-expiry`, `chore/ci-setup`
- Open a **Pull Request** into `main`. It needs **1 approving review** and a **green build** before merge.
- Keep branches short-lived — merge within a few days. Long-lived personal branches cause painful conflicts.
- Delete the branch after merge.

## Commits — Conventional Commits

Format: `type: short summary` (imperative mood, lowercase).

| Type | Use for |
|------|---------|
| `feat` | a new feature |
| `fix` | a bug fix |
| `chore` | tooling, config, deps |
| `docs` | documentation only |
| `refactor` | code change that isn't a feature or fix |
| `test` | adding or fixing tests |

Examples: `feat: add JWT refresh endpoint` · `fix: handle null email on register` · `docs: document API error shape`

## Code review

- Every PR gets **at least one review** before merge — no self-merging features.
- **Rotate reviewers** so knowledge spreads across the team rather than siloing (matches our cross-functional plan).
- Reviews are about the code, not the person. Be specific and kind.

## Definition of Done

A task is done when:
1. Code is merged to `main` via a reviewed PR.
2. The CI build passes.
3. At least a basic test exists for the new behaviour.
4. Any new endpoint is reflected in the API contract (`/docs`).

## Sprint cadence

- **Sprint length:** 2 weeks _(confirm/change as a team)_.
- **Stand-up:** short daily check-in — async in the team chat is fine if a synchronous time is hard to find.
- **Retrospective** at the end of each sprint: what went well, what to change.
- Board lives in **GitHub Projects**: Backlog → Sprint → In Progress → In Review → Done.

## Secrets

- **Never commit secrets.** No passwords, API keys, or service-account JSON in the repo.
- Local config goes in a `.env` file that is git-ignored. Commit a `.env.example` with empty placeholder keys.
