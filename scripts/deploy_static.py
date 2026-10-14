#!/usr/bin/env python3
"""Deploy a static dist/ folder to a Vercel project via the API (no git).

Usage: deploy_static.py <project-id> <dist-dir> [--prod]
Uploads each file via /v2/files, then creates a deployment referencing shas.
"""
import hashlib
import json
import os
import sys
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://api.vercel.com"
ALLOWED = ("api.vercel.com",)


def upload_file(path, data):
    """Upload raw bytes to /v2/files. Vercel keys files by SHA-1 of content,
    which must be sent as the x-vercel-digest header."""
    sha = hashlib.sha1(data).hexdigest()
    req = urllib.request.Request(
        BASE + "/v2/files", data=data, method="POST",
        headers={"Accept": "application/json",
                 "Content-Type": "application/octet-stream",
                 "x-vercel-digest": sha})
    add_surrogate_to_request(req, "custom.vercel", entry_name="access_token",
                             allowed_hosts=ALLOWED)
    with urllib.request.urlopen(req, timeout=180) as resp:
        read_json_response(resp)
    return sha


def main():
    project_id, dist = sys.argv[1], sys.argv[2]
    target = "production" if "--prod" in sys.argv else None

    files = []
    for root, _, names in os.walk(dist):
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, dist)
            with open(full, "rb") as f:
                data = f.read()
            # Vercel dedupes by content sha; upload and reference the sha
            sha = upload_file(rel, data)
            files.append({"file": rel, "sha": sha})
            print(f"uploaded {rel} ({len(data)} bytes) sha={sha[:12]}")

    # include vercel.json (rewrites etc.) at the root
    vj = os.path.join(os.path.dirname(dist.rstrip("/")), "vercel.json")
    if os.path.exists(vj):
        with open(vj, "rb") as f:
            data = f.read()
        sha = upload_file("vercel.json", data)
        files.append({"file": "vercel.json", "sha": sha})
        print(f"uploaded vercel.json sha={sha[:12]}")

    payload = {
        "name": "supfam-site",
        "project": project_id,
        "files": files,
        "projectSettings": {"framework": None, "buildCommand": "",
                            "installCommand": "", "outputDirectory": None},
    }
    if target:
        payload["target"] = target
    req = urllib.request.Request(
        BASE + "/v13/deployments", data=json.dumps(payload).encode(), method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json"})
    add_surrogate_to_request(req, "custom.vercel", entry_name="access_token",
                             allowed_hosts=ALLOWED)
    with urllib.request.urlopen(req, timeout=120) as resp:
        dep = read_json_response(resp)
    print("deployment:", dep.get("id"), dep.get("url"), "state:", dep.get("state"))


if __name__ == "__main__":
    main()
