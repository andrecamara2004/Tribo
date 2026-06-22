# Tribo

Run together. Compete together. Make impact.

A unified platform combining running tracking, clan-based team competition, and verified community volunteering — built for ADC 2026.

## Live

- **Web client:** https://web-dot-tribo-497810.ew.r.appspot.com
- **API:** https://tribo-497810.ew.r.appspot.com/rest (e.g. [`/health`](https://tribo-497810.ew.r.appspot.com/rest/health))

## Repository structure

This is a **monorepo**. Each subproject builds independently.

| Path | What it is | Build |
|------|-----------|-------|
| `/api` | Java REST API (Spring Boot), deployed to App Engine | Maven |
| `/web` | React web client | npm / Vite |
| `/mobile` | Flutter mobile app | Flutter |
| `/infra` | Cloud config, deployment notes, migration files | — |
| `/docs` | Team agreements, API contract, architecture notes | — |

## Tech stack

- **API:** Java + Spring Boot on App Engine Standard
- **Database:** Cloud SQL (PostgreSQL), schema managed by Flyway
- **Media:** Cloud Storage
- **Push:** Firebase Cloud Messaging
- **Clients:** Flutter (mobile), React + Vite (web)

## Getting started

Each subproject has its own README with setup steps. Start there.

## How we work

See [`/docs/WORKING-AGREEMENTS.md`](docs/WORKING-AGREEMENTS.md) for branching, commits, reviews, and sprint cadence.

## Team

André Câmara · Rafael Rodrigues · João Duarte · Martinho Pereira · Ricardo Pinéu

