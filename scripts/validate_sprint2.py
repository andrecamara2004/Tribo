#!/usr/bin/env python3
"""
End-to-end validation for the Sprint 2 backend (Activity Management + role
self-select/verification). Stdlib only — no pip installs.

Runs the full happy path plus the key error paths against a deployed API and
prints PASS/FAIL per check. Exits non-zero if any check fails.

Prereqs:
  - The Sprint 2 backend is deployed.
  - BOOTSTRAP_ADMIN_EMAIL is set to BOOTSTRAP_EMAIL below (so that account is a
    verified SYSADMIN and can verify the manager).

Usage:
  python scripts/validate_sprint2.py [BASE_URL]
  # default BASE_URL = https://tribo-497810.ew.r.appspot.com/rest
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tribo-497810.ew.r.appspot.com/rest"
BOOTSTRAP_EMAIL = "sprint2-bootstrap@tribo.test"
PW = "P@ssw0rd123"
RUN = str(int(time.time()))

passed = 0
failed = 0


def req(method, path, body=None, token=None):
    """Return (status, parsed_json_or_None)."""
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


def register(email, role=None):
    body = {"email": email, "password": PW, "fullName": "Test User",
            "phoneNumber": "+351912345678", "age": 25}
    if role:
        body["role"] = role
    return req("POST", "/auth/register", body)


def login(email):
    return req("POST", "/auth/login", {"email": email, "password": PW})


def register_or_login(email, role=None):
    st, _ = register(email, role)
    if st not in (201, 409):
        print(f"  (register {email} -> {st})")
    st, body = login(email)
    assert st == 200, f"login {email} failed: {st} {body}"
    return body


print(f"Validating Sprint 2 against {BASE}\n")

# --- 1. Bootstrap admin -----------------------------------------------------
print("1. Bootstrap admin")
admin = register_or_login(BOOTSTRAP_EMAIL)
check("bootstrap account is SYSADMIN", admin.get("role") == "SYSADMIN", admin)
check("bootstrap account is verified", admin.get("verified") is True, admin)
admin_tok = admin["accessToken"]

# --- 2. Privileged self-registration is rejected ----------------------------
print("2. Privileged role cannot be self-registered")
st, body = register(f"hacker-{RUN}@tribo.test", role="SYSADMIN")
check("register role=SYSADMIN -> 403 FORBIDDEN", st == 403 and code_of(body) == "FORBIDDEN",
      f"{st} {code_of(body)}")

# --- 3. Manager self-registers (unverified) ---------------------------------
print("3. Manager self-registers, starts unverified")
mgr_email = f"mgr-{RUN}@tribo.test"
st, reg = register(mgr_email, role="ACTIVITY_MANAGER")
check("register manager -> 201", st == 201, f"{st} {reg}")
check("manager starts verified=false", reg and reg.get("verified") is False, reg)
mgr = login(mgr_email)[1]
mgr_id = mgr["userId"]
mgr_tok = mgr["accessToken"]

# --- 4. Unverified manager cannot create ------------------------------------
print("4. Unverified manager is blocked from creating")
activity = {"title": "Sunset trail run", "description": "Easy 5k",
            "category": "sports", "location": "Caparica",
            "startsAt": "2027-07-01T18:00:00Z", "endsAt": "2027-07-01T19:30:00Z",
            "capacity": 2}
st, body = req("POST", "/activities", activity, token=mgr_tok)
check("create while unverified -> 403 ACCOUNT_NOT_VERIFIED",
      st == 403 and code_of(body) == "ACCOUNT_NOT_VERIFIED", f"{st} {code_of(body)}")

# --- 5. Backoffice verifies the manager -------------------------------------
print("5. Sysadmin verifies the manager")
st, body = req("POST", f"/users/{mgr_id}/verify", token=admin_tok)
check("verify manager -> 200 verified=true", st == 200 and body.get("verified") is True,
      f"{st} {body}")
# Non-privileged cannot verify:
st, body = req("POST", f"/users/{mgr_id}/verify", token=mgr_tok)
check("manager cannot verify (403)", st == 403, f"{st} {code_of(body)}")

# --- 6. Verified manager creates --------------------------------------------
print("6. Verified manager creates an activity")
st, act = req("POST", "/activities", activity, token=mgr_tok)
check("create -> 201", st == 201, f"{st} {act}")
check("owner set from JWT", act and act.get("ownerId") == mgr_id, act)
check("status PUBLISHED", act and act.get("status") == "PUBLISHED", act)
aid = act["id"]

# --- 7. Discovery ------------------------------------------------------------
print("7. Discovery")
st, page = req("GET", "/activities?status=PUBLISHED&limit=100", token=mgr_tok)
check("list -> 200 with items", st == 200 and isinstance(page.get("items"), list), st)
check("created activity appears in list", any(i["id"] == aid for i in page["items"]))
st, one = req("GET", f"/activities/{aid}", token=mgr_tok)
check("detail -> 200", st == 200 and one["id"] == aid, st)

# --- 8. Validation errors on create -----------------------------------------
print("8. Create validation")
bad = dict(activity); bad["endsAt"] = "2027-07-01T17:00:00Z"  # before start
st, body = req("POST", "/activities", bad, token=mgr_tok)
check("endsAt<startsAt -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR",
      f"{st} {code_of(body)}")

# --- 9. Participation --------------------------------------------------------
print("9. Participation")
u1 = register_or_login(f"user1-{RUN}@tribo.test"); u1_tok = u1["accessToken"]
u2 = register_or_login(f"user2-{RUN}@tribo.test"); u2_tok = u2["accessToken"]
st, _ = req("POST", f"/activities/{aid}/participants", token=u1_tok)
check("user1 joins -> 201", st == 201, st)
st, body = req("POST", f"/activities/{aid}/participants", token=u1_tok)
check("double join -> 409 ALREADY_JOINED", st == 409 and code_of(body) == "ALREADY_JOINED",
      f"{st} {code_of(body)}")
st, _ = req("POST", f"/activities/{aid}/participants", token=u2_tok)
check("user2 joins -> 201 (capacity 2)", st == 201, st)
u3 = register_or_login(f"user3-{RUN}@tribo.test")
st, body = req("POST", f"/activities/{aid}/participants", token=u3["accessToken"])
check("user3 join -> 409 ACTIVITY_FULL", st == 409 and code_of(body) == "ACTIVITY_FULL",
      f"{st} {code_of(body)}")

# --- 10. Roster (owner only) -------------------------------------------------
print("10. Roster authorization")
st, roster = req("GET", f"/activities/{aid}/participants", token=mgr_tok)
check("owner roster -> 200 count=2", st == 200 and roster.get("count") == 2, f"{st} {roster}")
st, body = req("GET", f"/activities/{aid}/participants", token=u1_tok)
check("non-owner roster -> 403 FORBIDDEN", st == 403 and code_of(body) == "FORBIDDEN",
      f"{st} {code_of(body)}")

# --- 11. Withdraw ------------------------------------------------------------
print("11. Withdraw (idempotent)")
st, _ = req("DELETE", f"/activities/{aid}/participants/me", token=u1_tok)
check("withdraw -> 204", st == 204, st)
st, _ = req("DELETE", f"/activities/{aid}/participants/me", token=u1_tok)
check("withdraw again -> 204 (idempotent)", st == 204, st)

# --- 12. Ownership on edit ---------------------------------------------------
print("12. Edit ownership")
st, body = req("PUT", f"/activities/{aid}", activity, token=u2_tok)
check("non-owner edit -> 403 FORBIDDEN", st == 403 and code_of(body) == "FORBIDDEN",
      f"{st} {code_of(body)}")
edit = dict(activity); edit["title"] = "Sunrise trail run"
st, body = req("PUT", f"/activities/{aid}", edit, token=mgr_tok)
check("owner edit -> 200 title updated", st == 200 and body.get("title") == "Sunrise trail run",
      f"{st} {body}")

# --- 13. Cancel + post-cancel join ------------------------------------------
print("13. Cancel")
st, body = req("POST", f"/activities/{aid}/cancel", token=mgr_tok)
check("owner cancel -> 200 CANCELLED", st == 200 and body.get("status") == "CANCELLED",
      f"{st} {body}")
st, body = req("POST", f"/activities/{aid}/participants", token=u3["accessToken"])
check("join cancelled -> 409 ACTIVITY_NOT_OPEN", st == 409 and code_of(body) == "ACTIVITY_NOT_OPEN",
      f"{st} {code_of(body)}")

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
