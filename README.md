# Tribo

Run together. Compete together. Make impact.

## Live

- **Web client:** https://web-dot-tribo-497810.ew.r.appspot.com
- **API:** https://tribo-497810.ew.r.appspot.com/rest (e.g. [`/health`](https://tribo-497810.ew.r.appspot.com/rest/health))

## Repository structure

This is a **monorepo**. Each subproject builds independently.

| Path | What it is | Build |
|------|-----------|-------|
| `/api` | Java REST API (JAX-RS), deployed to App Engine | Maven |
| `/web` | React web client | npm / Vite |
| `/mobile` | Flutter mobile app | Flutter |
| `/infra` | Shared business logic between repos inside monorepo
| `/docs` | Overall docs | — |

## Tech stack

- **API:** Java + Spring Boot on App Engine Standard
- **Database:** Cloud SQL (PostgreSQL), schema managed by Flyway
- **Media:** Cloud Storage
- **Push:** Firebase Cloud Messaging
- **Clients:** Flutter (mobile), React + Vite (web)

## Team

André Câmara · Rafael Rodrigues · João Duarte · Martinho Pereira · Ricardo Pinéu

