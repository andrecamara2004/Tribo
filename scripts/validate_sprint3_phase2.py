#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3 Phase 2 (Runs + derived stats). Stdlib only.

Covers POST/GET /runs, /runs/{id}, /runs/me/last, and /users/me/stats — happy
path plus key error paths. Exits non-zero if any check fails.

Usage:
  python scripts/validate_sprint3_phase2.py [BASE_URL]
  # default BASE_URL = https://tribo-497810.ew.r.appspot.com/rest
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tribo-497810.ew.r.appspot.com/rest"
PW = "P@ssw0rd123"
RUN = str(int(time.time()))

passed = 0
failed = 0


def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
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


def code_of(body):
    return (body or {}).get("error", {}).get("code")


def login(email):
    body = {"email": email, "password": PW, "fullName": "Run Tester",
            "phoneNumber": "+351912345678", "age": 30}
    req("POST", "/auth/register", body)
    st, b = req("POST", "/auth/login", {"email": email, "password": PW})
    assert st == 200, f"login {email} failed: {st} {b}"
    return b


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


print(f"Validating Sprint 3 Phase 2 against {BASE}\n")

now = datetime.now(timezone.utc)
a = login(f"runA-{RUN}@tribo.test")
a_tok, a_id = a["accessToken"], a["userId"]

# --- 1. Empty stats ----------------------------------------------------------
print("1. Stats before any runs")
st, s = req("GET", "/users/me/stats", token=a_tok)
check("stats -> 200", st == 200, st)
check("weeklyKm is length-7 array", isinstance(s.get("weeklyKm"), list) and len(s["weeklyKm"]) == 7, s)
check("avgPace null, streak 0, monthRuns 0",
      s.get("avgPaceSecPerKm") is None and s.get("streak") == 0 and s.get("monthRuns") == 0, s)

# --- 2. No last run yet ------------------------------------------------------
print("2. No last run yet")
st, body = req("GET", "/runs/me/last", token=a_tok)
check("last -> 404 NOT_FOUND", st == 404 and code_of(body) == "NOT_FOUND", f"{st} {code_of(body)}")

# --- 3. Log a run ------------------------------------------------------------
print("3. Log a run")
run1 = {
    "title": "Morning shakeout", "location": "Belém", "distanceMeters": 8400,
    "durationSeconds": 2301, "elevationMeters": 22, "routeType": "river",
    "startedAt": iso(now - timedelta(days=2)),
    "splits": [{"km": 1, "durationSeconds": 298}, {"km": 2, "durationSeconds": 292}],
}
st, r1 = req("POST", "/runs", run1, token=a_tok)
check("create -> 201", st == 201, f"{st} {r1}")
check("userId from JWT", r1 and r1.get("userId") == a_id, r1)
check("splits round-tripped", r1 and len(r1.get("splits", [])) == 2, r1)
r1_id = r1["id"]

# --- 4. Create validation ----------------------------------------------------
print("4. Create validation")
for label, bad in [
    ("missing distance", {k: v for k, v in run1.items() if k != "distanceMeters"}),
    ("zero duration", {**run1, "durationSeconds": 0}),
    ("bad startedAt", {**run1, "startedAt": "not-a-date"}),
]:
    st, body = req("POST", "/runs", bad, token=a_tok)
    check(f"{label} -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")

# --- 5. Detail + last + list -------------------------------------------------
print("5. Detail / last / list")
st, one = req("GET", f"/runs/{r1_id}", token=a_tok)
check("detail -> 200", st == 200 and one["id"] == r1_id, st)
st, last = req("GET", "/runs/me/last", token=a_tok)
check("last -> 200 is run1 (only run)", st == 200 and last["id"] == r1_id, f"{st} {last}")

# A second, more recent run should become 'last'.
run2 = {**run1, "title": "Tempo", "distanceMeters": 5000, "durationSeconds": 1500,
        "startedAt": iso(now), "splits": []}
st, r2 = req("POST", "/runs", run2, token=a_tok)
check("create run2 -> 201", st == 201, st)
st, last = req("GET", "/runs/me/last", token=a_tok)
check("last is the newer run2", st == 200 and last["id"] == r2["id"], f"{st} {last}")

st, page = req("GET", "/runs?scope=me&limit=10", token=a_tok)
check("list -> 200 with 2 items, newest first",
      st == 200 and len(page["items"]) == 2 and page["items"][0]["id"] == r2["id"], page)
st, clanpage = req("GET", "/runs?scope=clan", token=a_tok)
check("scope=clan -> 200 list", st == 200 and isinstance(clanpage.get("items"), list), st)

# --- 6. Stats after runs -----------------------------------------------------
print("6. Stats after runs")
st, s = req("GET", "/users/me/stats", token=a_tok)
check("avgPaceSecPerKm now an int", st == 200 and isinstance(s.get("avgPaceSecPerKm"), int), s)
check("monthRuns >= 1", s.get("monthRuns", 0) >= 1, s)
check("streak >= 1 (ran today)", s.get("streak", 0) >= 1, s)

# --- 7. Auth required --------------------------------------------------------
print("7. Auth required")
st, _ = req("POST", "/runs", run1)
check("log without token -> 401", st == 401, st)
st, _ = req("GET", "/users/me/stats")
check("stats without token -> 401", st == 401, st)

# --- 8. Fresh user has clean state ------------------------------------------
print("8. Fresh user isolation")
b = login(f"runB-{RUN}@tribo.test")
st, body = req("GET", "/runs/me/last", token=b["accessToken"])
check("new user last -> 404", st == 404, st)
st, page = req("GET", "/runs?scope=me", token=b["accessToken"])
check("new user has no runs", st == 200 and page["items"] == [], page)

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
