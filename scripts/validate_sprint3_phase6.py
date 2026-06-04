#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3.5 / Phase 6 (points, achievements, goals,
comments, ranking trend). Stdlib only.

Usage:
  python scripts/validate_sprint3_phase6.py [BASE_URL] [ADMIN_EMAIL] [ADMIN_PW]
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
    req("POST", "/auth/register", {"email": email, "password": PW, "fullName": "Phase6 Tester",
                                   "phoneNumber": "+351912345678", "age": 28})
    st, b = req("POST", "/auth/login", {"email": email, "password": PW})
    assert st == 200, f"login {email}: {st} {b}"
    return b


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def me(token):
    st, b = req("GET", "/users/me", token=token)
    assert st == 200, f"me: {st} {b}"
    return b


print(f"Validating Sprint 3 Phase 6 against {BASE}\n")

st, admin = req("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})
assert st == 200, f"admin login failed ({st}). {admin}"
atok = admin["accessToken"]
soon = datetime.now(timezone.utc) + timedelta(days=8)

evs = []
for i in range(3):
    st, ev = req("POST", "/activities", {"title": f"Cleanup {RUN}-{i}", "startsAt": iso(soon),
                 "endsAt": iso(soon + timedelta(hours=2)), "capacity": 10, "eventKind": "VOLUNTEER",
                 "verifiedBy": "PARTNER", "pointsParticipant": 100, "pointsStaff": 110, "staffCapacity": 2}, token=atok)
    assert st == 201, f"event {i}: {st} {ev}"
    evs.append(ev)

u1 = user(f"p6a-{RUN}@t.test")
t1, id1 = u1["accessToken"], u1["userId"]

# Fast run → Sub-5 pace achievement; pace 250 s/km.
st, r1 = req("POST", "/runs", {"title": "Fast 10k", "location": "Belem", "distanceMeters": 10000,
             "durationSeconds": 2500, "routeType": "river", "startedAt": iso(datetime.now(timezone.utc))}, token=t1)
assert st == 201, f"run: {st} {r1}"
for ev in evs:
    st, _ = req("POST", f"/activities/{ev['id']}/participants", token=t1)
    assert st == 201, f"join {ev['id']}: {st}"

# --- 1. Volunteer points credited -------------------------------------------
print("1. Volunteer points + standing")
m = me(t1)
check("volunteerPoints == 300", m.get("volunteerPoints") == 300, m.get("volunteerPoints"))
check("volunteerEvents == 3, staffEligible", m.get("volunteerEvents") == 3 and m.get("staffEligible") is True, m)

# --- 2. Achievements ---------------------------------------------------------
print("2. Achievements")
titles = {a["title"] for a in m.get("achievements", [])}
check("Sub-5 pace earned", "Sub-5 pace" in titles, titles)
check("Eco Runner earned (>=3 events)", "Eco Runner" in titles, titles)
check("Trusted staff earned (staff-eligible)", "Trusted staff" in titles, titles)

# --- 3. Weekly goal ----------------------------------------------------------
print("3. Weekly goal")
st, g = req("PUT", "/users/me/goal", {"weeklyGoalKm": 20}, token=t1)
check("set goal -> 200 weeklyGoalKm 20", st == 200 and g.get("weeklyGoalKm") == 20, f"{st} {g.get('weeklyGoalKm')}")
st, g = req("PUT", "/users/me/goal", {"weeklyGoalKm": 0}, token=t1)
check("clear goal -> 0", st == 200 and g.get("weeklyGoalKm") == 0, g.get("weeklyGoalKm"))
st, body = req("PUT", "/users/me/goal", {"weeklyGoalKm": -5}, token=t1)
check("negative goal -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")

# --- 4. Comments -------------------------------------------------------------
print("4. Comments")
item = r1["id"]
st, c = req("POST", f"/feed/{item}/comments", {"text": "Great pace!"}, token=t1)
check("add comment -> 201 with author", st == 201 and c.get("text") == "Great pace!" and c["author"]["name"] == "Phase6 Tester", f"{st} {c}")
cid = c["id"]
st, body = req("POST", f"/feed/{item}/comments", {"text": "  "}, token=t1)
check("blank comment -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")
st, lst = req("GET", f"/feed/{item}/comments", token=t1)
check("list comments -> 1", st == 200 and len(lst["items"]) == 1, lst)
st, feed = req("GET", "/feed?scope=all&limit=100", token=t1)
ri = next((it for it in feed["items"] if it["id"] == item), None)
check("feed commentCount == 1", ri and ri.get("commentCount") == 1, ri)
u2 = user(f"p6b-{RUN}@t.test")
st, body = req("DELETE", f"/feed/{item}/comments/{cid}", token=u2["accessToken"])
check("non-author delete -> 403", st == 403 and code_of(body) == "FORBIDDEN", f"{st} {code_of(body)}")
st, _ = req("DELETE", f"/feed/{item}/comments/{cid}", token=t1)
check("author delete -> 204", st == 204, st)
st, lst = req("GET", f"/feed/{item}/comments", token=t1)
check("comments now empty", st == 200 and lst["items"] == [], lst)

# --- 5. Ranking trend present ------------------------------------------------
print("5. Ranking trend")
st, rk = req("GET", "/clans/ranking?metric=avgPace&period=all", token=t1)
trends = {c.get("trend") for c in rk["clans"]}
check("every clan has a valid trend", st == 200 and trends.issubset({"up", "down", "flat"}) and len(rk["clans"]) > 0, trends)

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
