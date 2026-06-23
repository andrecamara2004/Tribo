# Tribo — deploy & run cheatsheet

Powershell

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
mvn clean package        
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

Had problems running on a default emulator because it was very slow so I had to find a way to make a faster emulator. Gave it more cores.

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
