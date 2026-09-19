#!/usr/bin/env python3
"""Deploy an edge function via the Supabase Management API deploy endpoint.

Usage: deploy_function.py <project-ref> <slug> <dir> [--no-verify-jwt]
Sends multipart file[] (source files) + metadata; the server bundles it.
"""
import io
import json
import mimetypes
import os
import sys
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://api.supabase.com"
ALLOWED = ("api.supabase.com",)


def encode_multipart(fields, files):
    boundary = "----supdeploy%d" % os.getpid()
    buf = io.BytesIO()
    for name, value in fields.items():
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        buf.write(f"{value}\r\n".encode())
    for name, (filename, content, ctype) in files:
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        buf.write(f"Content-Type: {ctype}\r\n\r\n".encode())
        buf.write(content)
        buf.write(b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    return buf.getvalue(), boundary


def main():
    ref, slug, fn_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    verify_jwt = "--no-verify-jwt" not in sys.argv

    index_path = os.path.join(fn_dir, "index.ts")
    with open(index_path, "rb") as f:
        source = f.read()

    metadata = {
        "name": slug,
        "slug": slug,
        "verify_jwt": verify_jwt,
        "entrypoint_path": "index.ts",
        "import_map": False,
    }
    body, boundary = encode_multipart(
        {"metadata": json.dumps(metadata)},
        [("file", ("index.ts", source, "application/typescript"))],
    )
    url = f"{BASE}/v1/projects/{ref}/functions/deploy?slug={slug}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    add_surrogate_to_request(req, "custom.supabase", entry_name="access_token", allowed_hosts=ALLOWED)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            print(json.dumps(read_json_response(resp), indent=2))
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode(errors='replace')}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
