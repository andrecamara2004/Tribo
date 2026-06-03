#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3 Phase 5 (Clan ranking). Stdlib only.

Builds two fresh clans with contrasting stats and checks that the ranking sorts
correctly per metric (avgPace, distance, impact), reports the right aggregates,
and validates inputs. Compares the two clans' RELATIVE ranks (other clans from
earlier runs may share the board).

Usage:
  python scripts/validate_sprint3_phase5.py [BASE_URL] [ADMIN_EMAIL] [ADMIN_PW]
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tribo-497810.ew.r.appspot.com/rest"
ADMIN_EMAIL = sys.argv[2] if len(sys.argv) > 2 else "admin@admin.com"
ADMIN_PW = sys.argv[3] if len(sys.argv) > 3 else "Admin1234"
PW = "P@ssw0rd123"
RUN = str(int(time.time()))
passed = failed = 0


def req(method, path, body=None, token=None):
    r = urllib.request.Request(BASE + path,
                               data=json.dumps(body).encode() if body is not None else None, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, None


def check(label, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print(f"  PASS  {label}")
    else:
        failed += 1; print(f"  FAIL  {label}   {detail}")


def code_of(b):
    return (b or {}).get("error", {}).get("code")


def user(email):
    req("POST", "/auth/register", {"email": email, "password": PW, "fullName": "Rank Tester",
                                   "phoneNumber": "+351912345678", "age": 26})
    st, b = req("POST", "/auth/login", {"email": email, "password": PW})
    assert st == 200, f"login {email}: {st} {b}"
    return b


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def ranking(token, metric="avgPace", period="all"):
    st, b = req("GET", f"/clans/ranking?metric={metric}&period={period}", token=token)
    assert st == 200, f"ranking: {st} {b}"
    return b["clans"]


def row(clans, cid):
    return next((c for c in clans if c["id"] == cid), None)


print(f"Validating Sprint 3 Phase 5 against {BASE}\n")

st, admin = req("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})
assert st == 200, f"admin login failed ({st}). {admin}"
atok = admin["accessToken"]
now = datetime.now(timezone.utc)

u1, u2 = user(f"rk1-{RUN}@t.test"), user(f"rk2-{RUN}@t.test")
t1, t2 = u1["accessToken"], u2["accessToken"]

# Clan A (u1): one fast 10 km run (pace 250 s/km), no volunteering.
st, ca = req("POST", "/clans", {"name": f"Fast Clan {RUN}", "tag": "RKA", "color": "#00B86B"}, token=t1)
assert st == 201, f"clan A: {st} {ca}"
req("POST", "/runs", {"title": "Fast 10k", "distanceMeters": 10000, "durationSeconds": 2500,
    "routeType": "river", "startedAt": iso(now)}, token=t1)

# Clan B (u2): one slower 5 km run (pace 360), plus a volunteer join for impact.
st, cb = req("POST", "/clans", {"name": f"Impact Clan {RUN}", "tag": "RKB", "color": "#3A7BD5"}, token=t2)
assert st == 201, f"clan B: {st} {cb}"
req("POST", "/runs", {"title": "Easy 5k", "distanceMeters": 5000, "durationSeconds": 1800,
    "routeType": "park", "startedAt": iso(now)}, token=t2)
st, ev = req("POST", "/activities", {"title": f"Cleanup {RUN}", "startsAt": iso(now + timedelta(days=8)),
    "endsAt": iso(now + timedelta(days=8, hours=2)), "capacity": 10, "eventKind": "VOLUNTEER",
    "verifiedBy": "PARTNER", "pointsParticipant": 100, "staffCapacity": 2}, token=atok)
assert st == 201, f"event: {st} {ev}"
st, _ = req("POST", f"/activities/{ev['id']}/participants", token=t2)
assert st == 201, f"u2 join: {st}"

aid, bid = ca["id"], cb["id"]

# --- 1. Aggregates -----------------------------------------------------------
print("1. Aggregates")
clans = ranking(t1)
a, b = row(clans, aid), row(clans, bid)
check("both clans present", a is not None and b is not None, clans)
check("A: 1 member, 10 km, pace ~250, 100% consistency",
      a["members"] == 1 and a["totalKm"] == 10.0 and 240 <= a["avgPaceSecPerKm"] <= 260
      and a["consistencyPct"] == 100, a)
check("A: no volunteer points, trend flat", a["volunteerPoints"] == 0 and a["trend"] == "flat", a)
check("B: pace ~360, volunteerPoints 100", 350 <= b["avgPaceSecPerKm"] <= 370 and b["volunteerPoints"] == 100, b)

# --- 2. metric=avgPace (faster first) ---------------------------------------
print("2. Sort by avgPace")
clans = ranking(t1, metric="avgPace")
check("A (250) ranks above B (360)", row(clans, aid)["rank"] < row(clans, bid)["rank"],
      f"A={row(clans, aid)['rank']} B={row(clans, bid)['rank']}")

# --- 3. metric=distance (more km first) -------------------------------------
print("3. Sort by distance")
clans = ranking(t1, metric="distance", period="all")
check("A (10 km) ranks above B (5 km)", row(clans, aid)["rank"] < row(clans, bid)["rank"],
      f"A={row(clans, aid)['rank']} B={row(clans, bid)['rank']}")

# --- 4. metric=impact (more points first) -----------------------------------
print("4. Sort by impact")
clans = ranking(t1, metric="impact")
check("B (100 pts) ranks above A (0)", row(clans, bid)["rank"] < row(clans, aid)["rank"],
      f"A={row(clans, aid)['rank']} B={row(clans, bid)['rank']}")

# --- 5. Validation + auth ----------------------------------------------------
print("5. Validation + auth")
st, body = req("GET", "/clans/ranking?metric=bogus", token=t1)
check("bad metric -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")
st, _ = req("GET", "/clans/ranking")
check("ranking without token -> 401", st == 401, st)

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
