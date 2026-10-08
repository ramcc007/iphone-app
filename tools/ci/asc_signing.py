#!/usr/bin/env python3
"""Short-lived App Store signing for CI, using only the App Store Connect API key (no Mac, no stored certificates).

  asc_signing.py setup   <workdir>   creates an Apple Distribution certificate (from a fresh private key) and an
                                     App Store provisioning profile for BUNDLE_ID, writes them into <workdir>, and
                                     prints KEY=VALUE lines for $GITHUB_ENV (CERT_ID, PROFILE_ID, PROFILE_NAME, PROFILE_UUID)
  asc_signing.py cleanup <workdir>   deletes that profile and revokes that certificate (safe to run twice)

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file), BUNDLE_ID, RUN_TAG (makes names unique).
Only the Python standard library and the openssl command are used. Revoking a distribution certificate after the
upload is safe: builds already uploaded to App Store Connect are not affected.
"""
import base64, json, os, subprocess, sys, time, urllib.error, urllib.request

API = "https://api.appstoreconnect.apple.com/v1"


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw_signature(der):
    """openssl gives an ECDSA signature as DER; JWT ES256 needs the raw 64-byte r||s."""
    def read_int(buf, i):
        assert buf[i] == 0x02
        length = buf[i + 1]
        value = buf[i + 2:i + 2 + length].lstrip(b"\x00")
        return value.rjust(32, b"\x00"), i + 2 + length
    assert der[0] == 0x30
    i = 3 if der[1] & 0x80 else 2
    r, i = read_int(der, i)
    s, _ = read_int(der, i)
    return r + s


def token():
    header = {"alg": "ES256", "kid": os.environ["ASC_KEY_ID"], "typ": "JWT"}
    now = int(time.time())
    payload = {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"}
    signing_input = (b64url(json.dumps(header).encode()) + "." + b64url(json.dumps(payload).encode())).encode()
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", os.environ["ASC_KEY_PATH"]],
                         input=signing_input, capture_output=True, check=True).stdout
    return signing_input.decode() + "." + b64url(der_to_raw_signature(der))


def call(method, path, body=None, ok_missing=False):
    request = urllib.request.Request(API + path, method=method,
                                     data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        if ok_missing and error.code == 404:
            return {}
        detail = error.read().decode(errors="replace")
        sys.exit(f"App Store Connect API {method} {path} failed ({error.code}): {detail}")


def setup(workdir):
    os.makedirs(workdir, exist_ok=True)
    key, csr = os.path.join(workdir, "dist.key"), os.path.join(workdir, "dist.csr")
    subprocess.run(["openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", csr,
                    "-subj", "/CN=NumFall CI " + os.environ.get("RUN_TAG", "") + "/C=US"], check=True, capture_output=True)
    with open(csr) as f:
        csr_text = f.read()

    cert = call("POST", "/certificates", {"data": {"type": "certificates", "attributes": {
        "certificateType": "DISTRIBUTION", "csrContent": csr_text}}})["data"]
    cert_id = cert["id"]
    with open(os.path.join(workdir, "dist.cer"), "wb") as f:
        f.write(base64.b64decode(cert["attributes"]["certificateContent"]))
    print(f"CERT_ID={cert_id}")
    sys.stdout.flush()

    bundle = os.environ["BUNDLE_ID"]
    found = call("GET", "/bundleIds?filter[identifier]=" + bundle + "&limit=200")["data"]
    matches = [b for b in found if b["attributes"]["identifier"] == bundle]
    if not matches:
        sys.exit(f"The App ID {bundle} is not registered in Certificates, Identifiers & Profiles.")

    name = "NumFall CI " + os.environ.get("RUN_TAG", str(int(time.time())))
    profile = call("POST", "/profiles", {"data": {"type": "profiles",
        "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
        "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": matches[0]["id"]}},
                          "certificates": {"data": [{"type": "certificates", "id": cert_id}]}}}})["data"]
    with open(os.path.join(workdir, "dist.mobileprovision"), "wb") as f:
        f.write(base64.b64decode(profile["attributes"]["profileContent"]))
    print(f"PROFILE_ID={profile['id']}")
    print(f"PROFILE_NAME={name}")
    print(f"PROFILE_UUID={profile['attributes']['uuid']}")


def cleanup():
    if os.environ.get("PROFILE_ID"):
        call("DELETE", "/profiles/" + os.environ["PROFILE_ID"], ok_missing=True)
        print("Deleted the CI provisioning profile.")
    if os.environ.get("CERT_ID"):
        call("DELETE", "/certificates/" + os.environ["CERT_ID"], ok_missing=True)
        print("Revoked the CI distribution certificate.")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("setup", "cleanup"):
        sys.exit(__doc__)
    setup(sys.argv[2]) if sys.argv[1] == "setup" else cleanup()
