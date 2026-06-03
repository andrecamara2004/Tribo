#!/usr/bin/env python3
"""
End-to-end validation for Sprint 3 Phase 1 (Profiles & Clans). Stdlib only.

Covers the happy path plus key error paths for GET /users/me and the Clan
endpoints (create/list/detail/join/leave), printing PASS/FAIL per check. Exits
non-zero if any check fails.

Prereqs:
  - The Sprint 3 Phase 1 backend is deployed (or running against the local
    Datastore emulator via `mvn appengine:run`).

Usage:
  python scripts/validate_sprint3.py [BASE_URL]
  # default BASE_URL = https://tribo-497810.ew.r.appspot.com/rest
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tribo-497810.ew.r.appspot.com/rest"
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


print(f"Validating Sprint 3 Phase 1 against {BASE}\n")

# --- 1. Profile read (GET /users/me) ----------------------------------------
print("1. GET /users/me")
a = register_or_login(f"clanA-{RUN}@tribo.test")
a_tok = a["accessToken"]
a_id = a["userId"]
st, me = req("GET", "/users/me", token=a_tok)
check("me -> 200", st == 200, f"{st} {me}")
check("me.userId matches login", me and me.get("userId") == a_id, me)
check("me has no clan yet", me and me.get("clan") is None, me)
check("me has handle + avatarColor", me and me.get("handle") and me.get("avatarColor"), me)
check("me never leaks passwordHash", me is not None and "passwordHash" not in me, me)

# --- 2. Auth required --------------------------------------------------------
print("2. Auth required")
st, body = req("GET", "/users/me")
check("me without token -> 401", st == 401, f"{st} {code_of(body)}")

# --- 3. Create clan (creator auto-joins) ------------------------------------
print("3. POST /clans")
st, clan = req("POST", "/clans",
               {"name": "Forest Runners", "tag": "FOR", "color": "#00B86B"}, token=a_tok)
check("create -> 201", st == 201, f"{st} {clan}")
check("ownerId set from JWT", clan and clan.get("ownerId") == a_id, clan)
check("memberCount == 1 (creator joined)", clan and clan.get("memberCount") == 1, clan)
cid = clan["id"]

# --- 4. Create validation ----------------------------------------------------
print("4. Create validation")
st, body = req("POST", "/clans", {"name": "X", "tag": "toolong", "color": "#00B86B"}, token=a_tok)
check("bad tag -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")
st, body = req("POST", "/clans", {"name": "X", "tag": "OK", "color": "green"}, token=a_tok)
check("bad color -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")
st, body = req("POST", "/clans", {"name": "  ", "tag": "OK", "color": "#00B86B"}, token=a_tok)
check("empty name -> 400", st == 400 and code_of(body) == "VALIDATION_ERROR", f"{st} {code_of(body)}")

# --- 5. me now shows the clan ------------------------------------------------
print("5. me reflects membership")
st, me = req("GET", "/users/me", token=a_tok)
check("me.clan populated", me and me.get("clan") and me["clan"].get("id") == cid, me)
check("me.clan has tag", me and me["clan"].get("tag") == "FOR", me)

# --- 6. List + detail --------------------------------------------------------
print("6. List + detail")
st, page = req("GET", "/clans", token=a_tok)
check("list -> 200 with items", st == 200 and isinstance(page.get("items"), list), st)
check("created clan in list", any(i["id"] == cid for i in page["items"]))
st, one = req("GET", f"/clans/{cid}", token=a_tok)
check("detail -> 200 memberCount=1", st == 200 and one.get("memberCount") == 1, f"{st} {one}")
st, body = req("GET", f"/clans/does-not-exist-{RUN}", token=a_tok)
check("unknown clan -> 404", st == 404 and code_of(body) == "NOT_FOUND", f"{st} {code_of(body)}")

# --- 7. Second user joins ----------------------------------------------------
print("7. Join")
b = register_or_login(f"clanB-{RUN}@tribo.test")
b_tok = b["accessToken"]
st, body = req("POST", f"/clans/{cid}/join", token=b_tok)
check("B joins -> 200", st == 200, f"{st} {body}")
st, one = req("GET", f"/clans/{cid}", token=a_tok)
check("memberCount == 2", one.get("memberCount") == 2, one)
st, me_b = req("GET", "/users/me", token=b_tok)
check("B.me.clan populated", me_b and me_b.get("clan") and me_b["clan"].get("id") == cid, me_b)
st, body = req("POST", f"/clans/unknown-{RUN}/join", token=b_tok)
check("join unknown clan -> 404", st == 404 and code_of(body) == "NOT_FOUND", f"{st} {code_of(body)}")

# --- 8. Leave (idempotent) ---------------------------------------------------
print("8. Leave")
st, _ = req("POST", "/clans/leave", token=b_tok)
check("B leaves -> 204", st == 204, st)
st, me_b = req("GET", "/users/me", token=b_tok)
check("B.me.clan back to null", me_b and me_b.get("clan") is None, me_b)
st, one = req("GET", f"/clans/{cid}", token=a_tok)
check("memberCount back to 1", one.get("memberCount") == 1, one)
st, _ = req("POST", "/clans/leave", token=b_tok)
check("leave again -> 204 (idempotent)", st == 204, st)

print(f"\n{'='*40}\n  {passed} passed, {failed} failed\n{'='*40}")
sys.exit(1 if failed else 0)
