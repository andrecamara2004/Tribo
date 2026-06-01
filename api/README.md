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

- **Java 17** (`java -version` to confirm)
- **Maven 3.9+** (`mvn -v`)
- **gcloud CLI** authenticated and pointed at your project:
  ```
  gcloud auth login
  gcloud config set project tribo-beta
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

For `tribo-beta` in `europe-west1`, that's `https://tribo-beta.ew.r.appspot.com`.

## Verify

```
curl https://tribo-beta.ew.r.appspot.com/rest/health
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

In a second terminal, export the env var and run the app:

```
export DATASTORE_EMULATOR_HOST=localhost:8081
mvn appengine:run
```

The client library auto-detects that variable and talks to the emulator instead of production.
