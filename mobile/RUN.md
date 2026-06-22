# Running the Tribo mobile app (fast emulator)

Quick guide to launch the Flutter app on a **smooth** Android emulator for a demo.
Shell: **PowerShell**. The app talks to the live backend — no local server needed.

> `adb` and `emulator` aren't on PATH. The lines below use their full paths.
> To type plain `adb` / `emulator`, add `%LOCALAPPDATA%\Android\Sdk\platform-tools`
> and `...\Sdk\emulator` to your PATH once.

## 1. Start the emulator (fast settings)

The defaults are slow. These flags make it usable: host GPU, more RAM/cores,
a cold boot (avoids the corrupt-snapshot hang), and a 0.6 window scale.

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7 `
  -gpu host -memory 4096 -cores 4 -scale 0.6 -no-snapshot-load -no-boot-anim
```

Leave that window open. Wait until the home screen appears (~30–60s).

If the window opens off-screen: click it and press **Win+↑** then **Win+↓**, or drag
a corner to resize.

## 2. Run the app

In a **new** PowerShell tab, from the `mobile/` folder:

```powershell
cd C:\Users\andre\Desktop\NOVA-FCT\ADC\Tribo\mobile
flutter pub get
flutter run -d emulator-5554
```

First build takes a couple of minutes (Gradle); after that it's fast.
While `flutter run` is attached: **r** = hot reload, **R** = hot restart, **q** = quit.

## 3. Demo login

A throwaway account that already exists on the live backend:

- **Email:** `navtest_1781701355@example.com`
- **Password:** `Passw0rd!23`

Or tap **Register** to create a fresh one live.

## What to show

- Splash screen with the Tribo logo on launch, **Tribo** app icon on the home screen.
- Land on **Home** after sign-in; bottom nav: **Home · Volunteer · Find · Profile**.
- **Volunteer** — activity catalog from the live API.
- **Find** — Google Map with activity pins (Lisbon).
- **Profile** — identity, role, clan, volunteer impact (`/users/me`).

## Handy

```powershell
# List devices / emulators
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds

# If the device shows "offline":
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reconnect offline
```
