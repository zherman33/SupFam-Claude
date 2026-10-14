#!/usr/bin/env python3
"""Sign an APK with a v1 (JAR) signature using a persistent Sup Fam key.

Generates (once) an RSA-2048 self-signed cert at KEY_PEM/CERT_PEM and reuses it
for every signing so future APK updates keep the same signing key (required by
Android for updates). Then:
  1. MANIFEST.MF  - SHA-256 digest of every zip entry (except signature files)
  2. CERT.SF      - SHA-256 digest of MANIFEST.MF + of each manifest section
  3. CERT.RSA     - PKCS#7 SignedData (DER) over CERT.SF bytes
Appends the three files to META-INF/ in a copy of the input APK.

Usage: sign_apk.py <input.apk> <output.apk>
"""
import base64
import datetime
import hashlib
import os
import sys
import zipfile

sys.path.insert(0, os.path.expanduser("~/workspace/.pylibs"))

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs7
from cryptography.x509.oid import NameOID

KEY_PEM = os.path.expanduser("~/workspace/supfam-android/signing-key.pem")
CERT_PEM = os.path.expanduser("~/workspace/supfam-android/signing-cert.pem")


def get_key_and_cert():
    if os.path.exists(KEY_PEM) and os.path.exists(CERT_PEM):
        key = serialization.load_pem_private_key(open(KEY_PEM, "rb").read(), password=None)
        cert = x509.load_pem_x509_certificate(open(CERT_PEM, "rb").read())
        return key, cert
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "Sup Fam"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Sup Fam"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject).issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=30 * 365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    open(KEY_PEM, "wb").write(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()))
    os.chmod(KEY_PEM, 0o600)
    open(CERT_PEM, "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    print("generated new signing key/cert", file=sys.stderr)
    return key, cert


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def is_signature_file(name: str) -> bool:
    n = name.upper()
    return n == "META-INF/MANIFEST.MF" or (
        n.startswith("META-INF/") and (n.endswith(".SF") or n.endswith(".RSA")
         or n.endswith(".DSA") or n.endswith(".EC")))


def main() -> int:
    src, dst = sys.argv[1], sys.argv[2]
    key, cert = get_key_and_cert()

    zin = zipfile.ZipFile(src, "r")
    names = [i.filename for i in zin.infolist()
             if not is_signature_file(i.filename)]

    # 1. MANIFEST.MF
    mf = ["Manifest-Version: 1.0\r\n", "Created-By: Sup Fam apk signer\r\n", "\r\n"]
    sections = {}
    for name in names:
        digest = b64(hashlib.sha256(zin.read(name)).digest())
        section = f"Name: {name}\r\nSHA-256-Digest: {digest}\r\n\r\n"
        sections[name] = section
        mf.append(section)
    manifest = "".join(mf).encode()

    # 2. CERT.SF
    sf = ["Signature-Version: 1.0\r\n", "Created-By: Sup Fam apk signer\r\n",
          f"SHA-256-Digest-Manifest: {b64(hashlib.sha256(manifest).digest())}\r\n", "\r\n"]
    for name in names:
        section = sections[name].encode()
        sf.append(f"Name: {name}\r\n"
                  f"SHA-256-Digest: {b64(hashlib.sha256(section).digest())}\r\n\r\n")
    sf_bytes = "".join(sf).encode()

    # 3. CERT.RSA (PKCS#7 over CERT.SF)
    rsa_der = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf_bytes)
        .add_signer(cert, key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.Binary])
    )

    with zipfile.ZipFile(src, "r") as zin2, zipfile.ZipFile(dst, "w") as zout:
        for item in zin2.infolist():
            if is_signature_file(item.filename):
                continue
            zout.writestr(item, zin2.read(item.filename))
        zout.writestr("META-INF/MANIFEST.MF", manifest)
        zout.writestr("META-INF/CERT.SF", sf_bytes)
        zout.writestr("META-INF/CERT.RSA", rsa_der)

    print(f"signed -> {dst} ({os.path.getsize(dst)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
