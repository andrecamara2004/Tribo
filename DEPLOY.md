# Tribo — deploy & run cheatsheet

Shell: **PowerShell**. Run each block from the repo root unless noted.

## 0. One-time prerequisites

```powershell
gcloud auth login
gcloud config set project tribo-497810
```

- API needs **Java 21** + **Maven 3.9+**.
- Web needs **Node 24 / npm 11**.

---

## 1. Deploy the API (App Engine `default` service)

```powershell
cd api
mvn clean package          # produces target/tribo-api.war
mvn appengine:deploy
cd ..
```

Verify:
```powershell
curl https://tribo-497810.ew.r.appspot.com/rest/health   # -> {"status":"ok"}
```

---

## 2. Deploy the Web app (App Engine `web` service)

The app.yaml serves the built `dist/`, so **build before deploying**.

```powershell
cd web
npm ci
npm run build
gcloud app deploy app.yaml --project tribo-497810
cd ..
```

Live at: https://web-dot-tribo-497810.ew.r.appspot.com

---

## 3. Run mobile on a fast emulator

The default emulator is slow; these flags make it smooth (host GPU, more
RAM/cores, cold boot, 0.6 window scale). `adb`/`emulator` aren't on PATH.

**Terminal 1 — start the emulator** (leave it open):
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7 `
  -gpu host -memory 4096 -cores 4 -scale 0.6 -no-snapshot-load -no-boot-anim
```

**Terminal 2 — run the app** (once the emulator is at its home screen):
```powershell
cd mobile
flutter pub get
flutter run -d emulator-5554
```

While `flutter run` is attached: **r** = hot reload, **R** = hot restart, **q** = quit.
The app targets the live backend above — no local API needed.

> Demo account (live backend): `clandemo_1781860078@example.com` / `Passw0rd23`
> (or tap **Register** to make a fresh one).

See `mobile/RUN.md` for emulator troubleshooting (off-screen window, offline device).
