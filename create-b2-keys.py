import base64
import getpass
import json
import urllib.error
import urllib.request

API_BASE = "https://api.backblazeb2.com"


def api_request(url, body=None, authorization=None):
    headers = {}

    if authorization:
        headers["Authorization"] = authorization

    data = None

    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Backblaze API returned HTTP {error.code}: {message}"
        ) from None


def authorize_account(key_id, application_key):
    credentials = f"{key_id}:{application_key}".encode("utf-8")
    encoded = base64.b64encode(credentials).decode("ascii")

    return api_request(
        f"{API_BASE}/b2api/v4/b2_authorize_account",
        authorization=f"Basic {encoded}",
    )


def create_key(api_url, auth_token, account_id, name, bucket_id, capabilities):
    return api_request(
        f"{api_url}/b2api/v4/b2_create_key",
        body={
            "accountId": account_id,
            "keyName": name,
            "bucketIds": [bucket_id],
            "capabilities": capabilities,
        },
        authorization=auth_token,
    )


def main():
    print("CreAtlantis - Backblaze B2 application key setup")
    print()

    master_key_id = input("Master application key ID: ").strip()
    master_application_key = getpass.getpass("Master application key secret: ")

    if not master_key_id or not master_application_key:
        raise ValueError("Both master key credentials are required.")

    print("\nAuthorizing with Backblaze...")

    auth = authorize_account(master_key_id, master_application_key)

    api_url = auth["apiInfo"]["storageApi"]["apiUrl"]
    auth_token = auth["authorizationToken"]
    account_id = auth["accountId"]

    print("Authorization successful.")

    print("\nRetrieving buckets...")

    result = api_request(
        f"{api_url}/b2api/v4/b2_list_buckets",
        body={"accountId": account_id},
        authorization=auth_token,
    )

    buckets = result["buckets"]

    for bucket in buckets:
        print(
            f"  {bucket['bucketName']} ({bucket['bucketType']}) [{bucket['bucketId']}]"
        )

    print()

    staging_name = input("Private staging bucket name: ").strip()
    public_name = input("Public media bucket name: ").strip()

    if not staging_name or not public_name:
        raise ValueError("Both bucket names are required.")

    if staging_name == public_name:
        raise ValueError("The two buckets must be different.")

    staging_bucket = next(
        (b for b in buckets if b["bucketName"] == staging_name),
        None,
    )

    public_bucket = next(
        (b for b in buckets if b["bucketName"] == public_name),
        None,
    )

    if staging_bucket is None:
        raise ValueError(f"Staging bucket not found: {staging_name}")

    if public_bucket is None:
        raise ValueError(f"Public bucket not found: {public_name}")

    if staging_bucket["bucketType"] != "allPrivate":
        raise ValueError("The staging bucket must be private.")

    if public_bucket["bucketType"] != "allPublic":
        raise ValueError("The public media bucket must be public.")

    print("\nThe following keys will be created:")
    print()
    print("1. creatlantis-staging")
    print("   Bucket: private staging")
    print("   Capabilities: listBuckets, listFiles, readFiles,")
    print("                 writeFiles, deleteFiles")
    print()
    print("2. creatlantis-public")
    print("   Bucket: public media")
    print("   Capabilities: listBuckets, writeFiles")
    print()

    confirmation = input("Create these keys? Type YES: ").strip()

    if confirmation != "YES":
        print("Cancelled. No keys created.")
        return

    print("\nCreating staging key...")

    staging_key = create_key(
        api_url,
        auth_token,
        account_id,
        "creatlantis-staging",
        staging_bucket["bucketId"],
        [
            "listFiles",
            "readFiles",
            "writeFiles",
            "deleteFiles",
        ],
    )

    print("\nSTAGING KEY CREATED")
    print(json.dumps(staging_key, indent=2))
    print("\nSave the applicationKey secret now!")
    print()

    print("Creating public key...")

    public_key = create_key(
        api_url,
        auth_token,
        account_id,
        "creatlantis-public",
        public_bucket["bucketId"],
        [
            "writeFiles",
        ],
    )

    print("\nPUBLIC KEY CREATED")
    print(json.dumps(public_key, indent=2))
    print("\nSave the applicationKey secret now!")

    print("\nBoth keys were created successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\nERROR: {error}")
        raise SystemExit(1)
