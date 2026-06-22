#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3 Phase 4 (Feed + minimal kudos). Stdlib only.

Checks the unified feed (run + volunteer items with denormalised author),
clan-scope filtering, and kudos like/unlike (count + likedByMe), including a
kudos call on a volunteer item id (which contains a ':').

Usage:
  python scripts/validate_sprint3_phase4.py [BASE_URL] [ADMIN_EMAIL] [ADMIN_PW]
  # defaults: prod base, admin@admin.com / Admin1234
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
                               data=json.dumps(body).encode() if body is not None else None,
                               method=method)
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
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label}   {detail}")


def user(email):
    req("POST", "/auth/register", {"email": email, "password": PW, "fullName": "Feed Tester",
                                   "phoneNumber": "+351912345678", "age": 29})
    st, b = req("POST", "/auth/login", {"email": email, "password": PW})
    assert st == 200, f"login {email}: {st} {b}"
    return b


def feed(token, scope="all"):
    st, b = req("GET", f"/feed?scope={scope}&limit=100", token=token)
    assert st == 200, f"feed {scope}: {st} {b}"
    return b["items"]


def find(items, **kw):
    for it in items:
        if all(it.get(k) == v for k, v in kw.items()):
            return it
    return None


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


print(f"Validating Sprint 3 Phase 4 against {BASE}\n")

st, admin = req("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})
assert st == 200, f"admin login failed ({st}). {admin}"
atok = admin["accessToken"]
soon = datetime.now(timezone.utc) + timedelta(days=8)

# Volunteer event hosted by admin.
st, ev = req("POST", "/activities", {"title": f"Cleanup {RUN}", "location": "Cais do Sodre",
             "startsAt": iso(soon), "endsAt": iso(soon + timedelta(hours=2)), "capacity": 10,
             "eventKind": "VOLUNTEER", "verifiedBy": "PARTNER", "distanceKm": 7.0,
             "staffCapacity": 2, "pointsParticipant": 100, "pointsStaff": 110, "tags": ["river"]}, token=atok)
assert st == 201, f"create event: {st} {ev}"

u1 = user(f"feed1-{RUN}@t.test")
u2 = user(f"feed2-{RUN}@t.test")
t1, id1 = u1["accessToken"], u1["userId"]
t2 = u2["accessToken"]

# u1 logs a run and joins the volunteer event; u2 logs a run.
st, r1 = req("POST", "/runs", {"title": "Tagus tempo", "location": "Belem", "distanceMeters": 8400,
             "durationSeconds": 2301, "routeType": "river", "startedAt": iso(datetime.now(timezone.utc))}, token=t1)
assert st == 201, f"u1 run: {st} {r1}"
st, _ = req("POST", f"/activities/{ev['id']}/participants", token=t1)
assert st == 201, f"u1 join: {st}"
st, r2 = req("POST", "/runs", {"title": "Park loop", "distanceMeters": 5000, "durationSeconds": 1500,
             "routeType": "park", "startedAt": iso(datetime.now(timezone.utc))}, token=t2)
assert st == 201, f"u2 run: {st} {r2}"

vol_id = f"{ev['id']}:{id1}"

# --- 1. Feed contains both item types with author denorm --------------------
print("1. Feed content")
items = feed(t1)
run_item = find(items, id=r1["id"])
vol_item = find(items, id=vol_id)
check("u1 run appears (type run)", run_item is not None and run_item["type"] == "run", run_item)
check("run item has distanceKm + pace + author",
      run_item and run_item.get("distanceKm") == 8.4 and run_item.get("paceSecPerKm", 0) > 0
      and run_item["author"]["name"] == "Feed Tester" and run_item["author"].get("color"), run_item)
check("volunteer join appears (type volunteer)", vol_item is not None and vol_item["type"] == "volunteer", vol_item)
check("volunteer item has points + verifiedBy + role",
      vol_item and vol_item.get("pointsEarned") == 100 and vol_item.get("verifiedBy") == "PARTNER"
      and vol_item.get("role") == "PARTICIPANT", vol_item)

# --- 2. Kudos on a run item --------------------------------------------------
print("2. Kudos (run item)")
st, k = req("POST", f"/feed/{r1['id']}/kudos", token=t1)
check("like -> 200 count 1 likedByMe", st == 200 and k.get("kudosCount") == 1 and k.get("likedByMe") is True, f"{st} {k}")
ri = find(feed(t1), id=r1["id"])
check("feed reflects like", ri and ri["kudosCount"] == 1 and ri["likedByMe"] is True, ri)
st, _ = req("DELETE", f"/feed/{r1['id']}/kudos", token=t1)
check("unlike -> 204", st == 204, st)
ri = find(feed(t1), id=r1["id"])
check("feed reflects unlike", ri and ri["kudosCount"] == 0 and ri["likedByMe"] is False, ri)

# --- 3. Kudos on a volunteer item (id contains ':') --------------------------
print("3. Kudos (volunteer item id with ':')")
st, k = req("POST", f"/feed/{vol_id}/kudos", token=t2)
check("like volunteer item -> 200", st == 200 and k.get("kudosCount") == 1, f"{st} {k}")
vi = find(feed(t1), id=vol_id)
check("u1 sees u2's kudos, not liked by u1", vi and vi["kudosCount"] == 1 and vi["likedByMe"] is False, vi)

# --- 4. Clan scope filters to clan members -----------------------------------
print("4. Clan scope")
st, _ = req("POST", "/clans", {"name": f"Feed Clan {RUN}", "tag": "FED", "color": "#00B86B"}, token=t1)
check("u1 creates clan -> 201", st == 201, st)
clan_items = feed(t1, scope="clan")
check("clan feed includes u1's run", find(clan_items, id=r1["id"]) is not None, "missing u1 run")
check("clan feed excludes u2's run", find(clan_items, id=r2["id"]) is None, "u2 run leaked")

# --- 5. Auth required --------------------------------------------------------
print("5. Auth required")
st, _ = req("GET", "/feed")
check("feed without token -> 401", st == 401, st)

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
