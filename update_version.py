import os

def get_current_version(version_file="VERSION"):
    with open(version_file, "r", encoding="utf-8") as f:
        return f.read().strip()
    
def update_version_in_file(file_path, old_version, new_version):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    updated_content = content.replace(old_version, new_version)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated_content)

def update_version_in_files(new_version, files_to_update):
    old_version = get_current_version()
    with open("VERSION", "w", encoding="utf-8") as f:
        f.write(new_version)
    for file_path in files_to_update:
        update_version_in_file(file_path, old_version, new_version)
    print(f"Version {old_version} updated to {new_version} in files: {', '.join(files_to_update)}")

if __name__ == "__main__":
    new_version = input("Enter the Version you want: ")
    files_to_update = ["Pipeline/cloudbuild.yaml", "Application/views/index.ejs"]
    update_version_in_files(new_version, files_to_update)
