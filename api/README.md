# Tribo API

JAX-RS (Jersey) on App Engine Standard, talking to Firestore in Datastore mode.

## Layout

```
api/
├── pom.xml                            Maven build, dependencies, App Engine plugin
└── src/main/
    ├── appengine/app.yaml             App Engine runtime config
    ├── webapp/WEB-INF/web.xml         Jersey servlet wiring
    └── java/com/tribo/api/
        ├── HealthResource.java        GET /rest/health
        ├── AuthResource.java          POST /rest/auth/{register,login,refresh,logout}
        ├── PingAuthResource.java      GET /rest/ping-auth/whoami (session-bootstrap probe)
        ├── iam/                       JWT, RBAC, password hashing, user + token repos
        └── error/                     ApiException hierarchy + JAX-RS ExceptionMapper
```

## Prerequisites

- **Java 21** (`java -version` to confirm)
- **Maven 3.9+** (`mvn -v`)
- **gcloud CLI** authenticated and pointed at your project:
  ```
  gcloud auth login
  gcloud config set project tribo-497810
  ```

## Build

```
mvn clean package
```

This produces `target/tribo-api.war`. If this fails, the deploy will fail too, so fix it here first.

## Deploy to App Engine

```
mvn appengine:deploy
```

On first deploy, App Engine may ask to enable additional APIs — say yes. After deploy completes, the API is live at:

```
https://<your-project-id>.<region>.r.appspot.com
```

For `tribo-497810` in `europe-west1`, that's `https://tribo-497810.ew.r.appspot.com`.

## Verify

```
curl https://tribo-497810.ew.r.appspot.com/rest/health
# → {"status":"ok"}
```

If that works, the API is deployed, Jersey is wired, and JSON serialisation works. Datastore read/write is exercised by the real IAM endpoints (`/rest/auth/register` → `/rest/auth/login`).

> The old `/ping-db` and `/ping-user` connectivity probes were removed in the Sprint 1 security close-out (SEC-0) — they wrote to real Datastore kinds and `/ping-user/mint-token` was a public RBAC bypass. See `docs/sprint-2-backlog.md` §1.

## Local development with the emulator

To develop without hitting real Firestore, run the Datastore emulator:

```
gcloud components install cloud-datastore-emulator
gcloud beta emulators datastore start --host-port=localhost:8081
```

> **Windows gotcha — CLOUDSDK_PYTHON.** If `gcloud beta emulators datastore start`
> fails on Windows, Python may not be on the PATH. Fix:
> `$env:CLOUDSDK_PYTHON = "C:\path\to\python.exe"`
>
> **Emulator gotcha — project ID must equal app ID.** The Datastore emulator
> rejects requests if `DATASTORE_PROJECT_ID` doesn't match the App Engine app ID.
> Set `DATASTORE_PROJECT_ID=tribo-497810` and `DATASTORE_USE_PROJECT_ID_AS_APP_ID=true`
> before running the app locally (see Windows commands above).

In a second terminal, export the env var and run the app:

```
# Linux / macOS
export DATASTORE_EMULATOR_HOST=localhost:8081
export JWT_SECRET="local-dev-secret-change-me"
mvn appengine:run

# Windows (PowerShell)
$env:DATASTORE_EMULATOR_HOST = "localhost:8081"
$env:DATASTORE_PROJECT_ID = "tribo-497810"
$env:DATASTORE_USE_PROJECT_ID_AS_APP_ID = "true"
$env:JWT_SECRET = "local-dev-secret-change-me"
mvn appengine:run
```

The client library auto-detects that variable and talks to the emulator instead of production.

## JWT signing secret (SEC-1)

In production the JWT signing secret is **not** in source/config — `JwtIssuer`
reads it at runtime from **Google Secret Manager** (secret `tribo-jwt-secret`,
latest version; the App Engine default service account has `secretAccessor`).

Locally there's no Secret Manager, so set the secret as an env var before running:

```
# any long random string works for local dev
export JWT_SECRET="local-dev-secret-change-me"
mvn appengine:run
```

Resolution order is Secret Manager → `JWT_SECRET` env var → fail-fast. To rotate
the production secret, add a new version: `gcloud secrets versions add
tribo-jwt-secret --data-file=- --project tribo-497810` (existing access tokens
become invalid at their next verification; clients just re-login).
