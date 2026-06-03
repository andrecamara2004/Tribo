#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3 Phase 3 (Volunteer events). Stdlib only.

Covers the volunteer extensions on Activity + role-based participation: creating
a VOLUNTEER event, derived counts, staff eligibility (≥3 volunteer events),
per-role capacity (STAFF_FULL / ACTIVITY_FULL), NOT_A_VOLUNTEER_EVENT, and the
/users/me staffEligible fields.

Needs a verified creator (ACTIVITY_MANAGER/PARTNER/SYSADMIN). Uses the seeded
SYSADMIN by default; override with args.

Usage:
  python scripts/validate_sprint3_phase3.py [BASE_URL] [ADMIN_EMAIL] [ADMIN_PW]
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


def user(email):
    req("POST", "/auth/register", {"email": email, "password": PW, "fullName": "Vol Tester",
                                   "phoneNumber": "+351912345678", "age": 27})
    st, b = req("POST", "/auth/login", {"email": email, "password": PW})
    assert st == 200, f"login {email} failed: {st} {b}"
    return b["accessToken"]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


print(f"Validating Sprint 3 Phase 3 against {BASE}\n")

st, admin = req("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})
assert st == 200, f"admin login failed ({st}). Pass admin email/pw as args. {admin}"
atok = admin["accessToken"]
soon = datetime.now(timezone.utc) + timedelta(days=7)
ends = soon + timedelta(hours=2)


def make_vol(title, capacity=5, staff=1):
    body = {"title": title, "startsAt": iso(soon), "endsAt": iso(ends), "capacity": capacity,
            "eventKind": "VOLUNTEER", "host": "Quercus", "distanceKm": 7.0,
            "verifiedBy": "PARTNER", "staffCapacity": staff,
            "pointsParticipant": 100, "pointsStaff": 110, "tags": ["River", "Easy"]}
    st, a = req("POST", "/activities", body, token=atok)
    assert st == 201, f"create {title} failed: {st} {a}"
    return a


# --- 1. Create a volunteer event --------------------------------------------
print("1. Create volunteer event")
e1 = make_vol(f"Tagus Cleanup {RUN}")
check("eventKind VOLUNTEER", e1.get("eventKind") == "VOLUNTEER", e1)
check("staff/points/verifiedBy stored",
      e1.get("staffCapacity") == 1 and e1.get("pointsStaff") == 110 and e1.get("verifiedBy") == "PARTNER", e1)
check("tags lowercased", e1.get("tags") == ["river", "easy"], e1)
# Derived counts/userRole live on the READ views (GET detail/list), not the
# create response (which returns the raw Activity) — per the contract.
st, e1d = req("GET", f"/activities/{e1['id']}", token=atok)
check("detail: fresh counts + null role",
      e1d.get("participantsJoined") == 0 and e1d.get("staffJoined") == 0 and e1d.get("userRole") is None, e1d)

# --- 2. Create validation ----------------------------------------------------
print("2. Create validation")
st, body = req("POST", "/activities", {"title": "x", "startsAt": iso(soon), "endsAt": iso(ends),
               "capacity": 5, "eventKind": "BOGUS"}, token=atok)
check("bad eventKind -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")
st, body = req("POST", "/activities", {"title": "x", "startsAt": iso(soon), "endsAt": iso(ends),
               "capacity": 5, "pointsParticipant": -5}, token=atok)
check("negative points -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")

e2 = make_vol(f"Monsanto Sweep {RUN}")
e3 = make_vol(f"Sintra Plogging {RUN}")
estaff = make_vol(f"Belem Staffed {RUN}", staff=1)
efull = make_vol(f"Tiny {RUN}", capacity=1)
st, erun = req("POST", "/activities", {"title": f"Plain run {RUN}", "startsAt": iso(soon),
               "endsAt": iso(ends), "capacity": 5}, token=atok)  # eventKind defaults RUN

u1, u2, u3 = user(f"v1-{RUN}@t.test"), user(f"v2-{RUN}@t.test"), user(f"v3-{RUN}@t.test")

# --- 3. Staff eligibility gate ----------------------------------------------
print("3. Staff eligibility")
st, body = req("POST", f"/activities/{estaff['id']}/participants?role=staff", token=u3)
check("ineligible staff join -> 403 NOT_STAFF_ELIGIBLE",
      st == 403 and code_of(body) == "NOT_STAFF_ELIGIBLE", f"{st} {code_of(body)}")

for e in (e1, e2, e3):
    st, p = req("POST", f"/activities/{e['id']}/participants", token=u1)
    check(f"u1 joins {e['title'][:14]} as participant -> 201", st == 201 and p.get("role") == "PARTICIPANT", f"{st} {p}")

st, me = req("GET", "/users/me", token=u1)
check("u1 me.volunteerEvents >= 3 and staffEligible", me.get("volunteerEvents", 0) >= 3 and me.get("staffEligible") is True, me)

# --- 4. Join as staff --------------------------------------------------------
print("4. Join as staff")
st, p = req("POST", f"/activities/{estaff['id']}/participants?role=staff", token=u1)
check("eligible staff join -> 201 role STAFF", st == 201 and p.get("role") == "STAFF", f"{st} {p}")
st, d = req("GET", f"/activities/{estaff['id']}", token=u1)
check("detail staffJoined=1, userRole STAFF", d.get("staffJoined") == 1 and d.get("userRole") == "STAFF", d)

# --- 5. STAFF_FULL -----------------------------------------------------------
print("5. Staff capacity")
for e in (e1, e2, e3):
    req("POST", f"/activities/{e['id']}/participants", token=u2)  # make u2 eligible too
st, body = req("POST", f"/activities/{estaff['id']}/participants?role=staff", token=u2)
check("staff over capacity -> 409 STAFF_FULL", st == 409 and code_of(body) == "STAFF_FULL", f"{st} {code_of(body)}")

# --- 6. NOT_A_VOLUNTEER_EVENT ------------------------------------------------
print("6. Staff on a plain run")
st, body = req("POST", f"/activities/{erun['id']}/participants?role=staff", token=u1)
check("staff on RUN event -> 409 NOT_A_VOLUNTEER_EVENT",
      st == 409 and code_of(body) == "NOT_A_VOLUNTEER_EVENT", f"{st} {code_of(body)}")

# --- 7. Participant capacity + already joined --------------------------------
print("7. Participant capacity")
st, _ = req("POST", f"/activities/{efull['id']}/participants", token=u1)
check("u1 joins tiny -> 201", st == 201, st)
st, body = req("POST", f"/activities/{efull['id']}/participants", token=u2)
check("u2 over capacity -> 409 ACTIVITY_FULL", st == 409 and code_of(body) == "ACTIVITY_FULL", f"{st} {code_of(body)}")
st, body = req("POST", f"/activities/{efull['id']}/participants", token=u1)
check("u1 double join -> 409 ALREADY_JOINED", st == 409 and code_of(body) == "ALREADY_JOINED", f"{st} {code_of(body)}")

# --- 8. Roster carries role (owner only) -------------------------------------
print("8. Roster role")
st, roster = req("GET", f"/activities/{estaff['id']}/participants", token=atok)
check("roster -> 200 with a STAFF entry",
      st == 200 and any(p.get("role") == "STAFF" for p in roster.get("participants", [])), f"{st} {roster}")

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
