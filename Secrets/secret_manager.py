import os
from google.cloud import secretmanager
from dotenv import load_dotenv

def create_secret(client, project_id, secret_id, secret_value):
    try:
        # Attempt to create the secret
        secret = client.create_secret(
            parent=f"projects/{project_id}",
            secret_id=secret_id,
            secret=secretmanager.Secret(
                replication=secretmanager.Replication(
                    automatic=secretmanager.Replication.Automatic(),  # Correctly referenced
                )
            ),
        )
        print(f"✔ Created secret: {secret_id}.")
    except Exception as e:
        # Output when the secret already exists
        if "already exists" in str(e):
            print(f"🔒 Secret already exists: {secret_id}.")
        else:
            print(f"❌ Error creating secret {secret_id}: {e}")
        return  # Exit the function early if secret creation fails

    # If secret was created or already exists, add a new version
    client.add_secret_version(
        parent=secret.name,
        payload={"data": secret_value.encode("UTF-8")},
    )
    print(f"✔ Added secret version for: {secret_id}.")

def read_keyfile(file_path):
    """Read the contents of the key file."""
    with open(file_path, 'r') as file:
        return file.read()

def main():
    env_file_path = 'Application/.env'
    load_dotenv(env_file_path)
    
    if 'GOOGLE_APPLICATION_CREDENTIALS' not in os.environ:
        print("GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Please set it to the path of your service account key JSON file.")
        return

    project_id = os.getenv("PROJECT_ID")

    if not project_id:
        print("PROJECT_ID not found in the .env file.")
        return

    client = secretmanager.SecretManagerServiceClient()

    keyfile_path = 'Application/keys/networking.json'
    if os.path.exists(keyfile_path):
        keyfile_content = read_keyfile(keyfile_path)
        if create_secret(client, project_id, "GCP_KEYFILE", keyfile_content):
            print("✔ Created GCP_KEYFILE secret with the key file contents.")
        else:
            print("🔒 GCP_KEYFILE secret already exists, added a new version.")

    for key, value in os.environ.items():
        if key.startswith("GCP_") or key.startswith("SECRET_") or key in ["PORT", "JWT_SECRET", "FIREBASE_DB_URL", "FUNCTION_COPY_URL", "FUNCTION_DELETE_URL", "REPOSITORY_NAME", "REGION_PROJECT", "LOGS_BUCKET", "SERVICE_ACCOUNT"]:
            if create_secret(client, project_id, key, value):
                print(f"✔ Created secret: {key}.")
            else:
                print(f"🔒 Secret already exists: {key}, added a new version.")

if __name__ == "__main__":
    main()
