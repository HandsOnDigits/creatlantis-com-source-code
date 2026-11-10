import base64
import getpass
import json
import urllib.error
import urllib.request

API_URL = "https://api.backblazeb2.com/b2api/v4/b2_authorize_account"


def authorize(label):
    print(f"\n{label}")

    key_id = input("Application key ID: ").strip()
    secret = getpass.getpass("Application key secret: ")

    credentials = base64.b64encode(f"{key_id}:{secret}".encode()).decode()

    request = urllib.request.Request(
        API_URL,
        headers={"Authorization": f"Basic {credentials}"},
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        print(f"Authorization failed: HTTP {error.code}")
        print(error.read().decode(errors="replace"))
        return None

    allowed = result["apiInfo"]["storageApi"]["allowed"]

    buckets = allowed.get("buckets", [])
    capabilities = allowed.get("capabilities", [])

    print("Authorization: SUCCESS")
    print("Allowed buckets:")

    for bucket in buckets:
        print(f"  - {bucket.get('name')} ({bucket['id']})")

    print("Capabilities:")
    for capability in sorted(capabilities):
        print(f"  - {capability}")

    return {
        "buckets": buckets,
        "capabilities": capabilities,
    }


def main():
    staging = authorize("STAGING KEY")
    public = authorize("PUBLIC KEY")

    if staging is None or public is None:
        raise SystemExit("One or both keys failed authorization.")

    print("\nVerification completed.")
    print("No files were uploaded, downloaded or deleted.")


if __name__ == "__main__":
    main()
