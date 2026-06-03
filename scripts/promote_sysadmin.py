#!/usr/bin/env python3
"""
One-off admin utility: promote an existing user to a verified SYSADMIN by
editing their Datastore entity directly.

Why this exists: roles are self-selected at registration and there is no
role-change endpoint (D-1). The BOOTSTRAP_ADMIN_EMAIL seed only applies at
*registration* time, so it cannot promote an account that already exists. This
script performs the promotion out-of-band, using your gcloud credentials —
it is NOT a deployed endpoint (no backdoor; running it requires GCP project
access, same trust level as a deploy).

It reads the User entity by email, sets role=SYSADMIN and verified=true while
preserving every other property (passwordHash, name, etc.), and writes it back.

Usage:
  gcloud config set project tribo-497810   # once
  python scripts/promote_sysadmin.py admin@admin.com [PROJECT_ID]

Requires: an authenticated gcloud (`gcloud auth list`) with Datastore access.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

EMAIL = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
PROJECT = sys.argv[2] if len(sys.argv) > 2 else "tribo-497810"
API = f"https://datastore.googleapis.com/v1/projects/{PROJECT}"

if not EMAIL:
    sys.exit("usage: python scripts/promote_sysadmin.py <email> [project]")


def access_token() -> str:
    out = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, shell=(sys.platform == "win32"),
    )
    if out.returncode != 0:
        sys.exit(f"gcloud auth print-access-token failed:\n{out.stderr}")
    return out.stdout.strip()


def call(endpoint: str, body: dict, token: str) -> dict:
    req = urllib.request.Request(
        f"{API}:{endpoint}",
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"{endpoint} -> HTTP {e.code}\n{e.read().decode()}")


def main():
    token = access_token()

    # 1. Find the User entity by email.
    query = {
        "query": {
            "kind": [{"name": "User"}],
            "filter": {
                "propertyFilter": {
                    "property": {"name": "email"},
                    "op": "EQUAL",
                    "value": {"stringValue": EMAIL},
                }
            },
            "limit": 1,
        }
    }
    res = call("runQuery", query, token)
    entity_results = res.get("batch", {}).get("entityResults", [])
    if not entity_results:
        sys.exit(f"No User found with email {EMAIL}. Nothing changed.")

    entity = entity_results[0]["entity"]
    props = entity.get("properties", {})
    before_role = props.get("role", {}).get("stringValue")
    before_verified = props.get("verified", {}).get("booleanValue")
    print(f"Found {EMAIL}: role={before_role}, verified={before_verified}")

    if before_role == "SYSADMIN" and before_verified is True:
        print("Already a verified SYSADMIN — nothing to do.")
        return

    # 2. Mutate only role + verified; everything else is preserved as-is.
    props["role"] = {"stringValue": "SYSADMIN"}
    props["verified"] = {"booleanValue": True}

    # 3. Commit a non-transactional update (entity must already exist).
    commit = {"mode": "NON_TRANSACTIONAL", "mutations": [{"update": entity}]}
    call("commit", commit, token)
    print("Committed: role=SYSADMIN, verified=true")

    # 4. Verify.
    res = call("runQuery", query, token)
    p = res["batch"]["entityResults"][0]["entity"]["properties"]
    print(f"Verified now: role={p.get('role', {}).get('stringValue')}, "
          f"verified={p.get('verified', {}).get('booleanValue')}")


if __name__ == "__main__":
    main()
