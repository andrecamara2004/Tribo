# Tribo — BETA Live Demo Script

Exact, timed click-path for the plenary demo. Two demos, ~1 minute each (slides 7 and 8).
**Total live time target: ~2 minutes.** Rehearse it twice.

- **Web (live):** https://web-dot-tribo-497810.ew.r.appspot.com
- **API (live):** https://tribo-497810.ew.r.appspot.com/rest

---

## Accounts

| Role | Email | Password | Use |
|------|-------|----------|-----|
| SYSADMIN / backoffice | `admin@gmail.com` | `TriboSysadmin2026` | Approves activities, user mgmt |
| ACTIVITY_MANAGER | _create before the talk_ (see Prep) | _your choice_ | Creates the activity to be approved |

> There is no password-reset endpoint — keep the sysadmin password safe; don't change it before the demo.

---

## PREP — do this the morning of the talk (NOT live)

The "wow" is approving an activity in 5 seconds on stage. Pre-stage it so there's a **pending activity already waiting**:

1. **Register a manager** (web `/register`): role = Activity Manager. Note the email/password in the table above.
2. **Verify the manager:** log in as sysadmin → **Backoffice** → Users → find the manager → **Verify**.
3. **Create a pending activity:** log out, log in as the manager → create an activity (give it an obvious title like **"BETA Demo Clean-up Run"**, set a location on the map, capacity, future date). It will land in **PENDING_APPROVAL**.
4. **Leave it pending** — do *not* approve it yet. That's what you approve live.
5. **Pre-warm everything** ~10 min before: open the web app and log in as sysadmin in one browser tab; boot the emulator and launch the app (commands below) so first-load lag is gone.
6. **Record a 60–90s fallback capture** of both demos in case the room's network fails — drop it on slides 7–8 as a backup video. (Windows: `Win+Alt+R` game-bar, or OBS.)

---

## DEMO 1 — WEB  (slide 7, ~1 min)

Start already logged in as **sysadmin**, on the landing page in a fresh tab.

1. **Landing** (`/`) — "This is live, deployed on Google Cloud." *(5s)*
2. **Login** — show you're signed in (or sign in if pre-warmed). *(5s)*
3. **Feed** (`/feed`) — "Social feed of runs and volunteer joins — kudos and comments." Scroll once. *(10s)*
4. **Clan** (`/clan`) — "Clan leaderboard — ranked by pace, distance, consistency, impact." Toggle the metric selector once. *(10s)*
5. **Backoffice** (`/backoffice`) — **the moment**:
   - "A manager submitted this activity — it's **pending**, not public."
   - Click **Approve** on *BETA Demo Clean-up Run*. *(10s)*
6. **Show it's now public** — go to **Find/Discover** (`/discover`) or **Activities**; the just-approved activity now appears on the map / in the catalog. "Approved → instantly in the public catalog. End to end, live." *(15s)*

> If network is flaky: narrate over the fallback video instead — same script.

---

## DEMO 2 — MOBILE  (slide 8, ~1 min)

App already running on the emulator (see launch commands). Start on the **Landing** screen, logged out.

1. **Landing** — "Branded native landing — same platform, on Android." *(5s)*
2. **Login** — tap *I already have an account* → log in as sysadmin (or a pre-made end-user). *(10s)*
3. **Feed tab** — lands here after login. *(5s)*
4. **Volunteer tab** — volunteer activities list. *(10s)*
5. **Find tab** — map-based discovery. *(10s)*
6. **Clan tab** — clan rankings, mirrors the web. *(10s)*
7. **Profile tab** — stats, achievements, weekly goal. "Same backend as the web app." *(10s)*

> Type credentials with the **emulator's keyboard / your PC keyboard**, not `adb shell input text` — `adb` drops underscores. The sysadmin email has none, so it's safe either way.

---

## Emulator launch commands (run before the talk)

PowerShell / Git Bash on this machine. Boot the fast emulator and launch the installed app:

```bash
# 1) Boot the emulator (fast flags)
"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Pixel_7 -gpu host -no-boot-anim -netfast &

# 2) Wait for boot
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
"$ADB" wait-for-device
until [ "$("$ADB" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done

# 3a) Fresh build + run (use this if you changed code):
cd mobile && flutter run -d emulator-5554
#   ^ leave this terminal open during the demo — closing it kills the app.

# 3b) OR just relaunch the already-installed app (faster, no rebuild):
"$ADB" shell monkey -p com.tribo.tribo_mobile -c android.intent.category.LAUNCHER 1
```

- App package: **`com.tribo.tribo_mobile`** · AVD: **`Pixel_7`** · device id: **`emulator-5554`**
- If you want the APK to hand around: `cd mobile && flutter build apk --release` → `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## Failure fallbacks (have these ready)

| If… | Then… |
|-----|-------|
| Room Wi-Fi is down | Play the pre-recorded 60–90s capture; narrate the same script. |
| Web login fails | You're pre-warmed in a logged-in tab — just switch to it. |
| Emulator is slow/cold | Pre-boot 10 min early; use launch path **3b** (no rebuild). |
| Approve button does nothing | Refresh the backoffice page once; the pending item re-loads. |
| You're over time | Cut Demo 2 to **login → Feed → Clan only** (30s). |
