"""Generate local configuration without replacing an existing installation."""

import os
import secrets
from pathlib import Path


def main():
    directory = Path(__file__).resolve().parent
    target = directory / ".env"
    if target.exists():
        raise SystemExit(".env already exists; existing configuration was preserved.")
    jwt = "string:" + secrets.token_hex(32)
    postgres = secrets.token_urlsafe(24)
    writer = secrets.token_urlsafe(24)
    reader = secrets.token_urlsafe(24)
    values = {
        "POSTGRES_PASSWORD": postgres,
        "CKAN_DB_PASSWORD": writer,
        "DATASTORE_READONLY_PASSWORD": reader,
        "CKAN_SQLALCHEMY_URL": f"postgresql://ckandbuser:{writer}@db/ckandb",
        "CKAN_DATASTORE_WRITE_URL": f"postgresql://ckandbuser:{writer}@db/datastore",
        "CKAN_DATASTORE_READ_URL": f"postgresql://datastore_ro:{reader}@db/datastore",
        "CKAN_SYSADMIN_PASSWORD": secrets.token_urlsafe(24),
        "CKAN___BEAKER__SESSION__SECRET": secrets.token_hex(32),
        "CKAN___API_TOKEN__JWT__ENCODE__SECRET": jwt,
        "CKAN___API_TOKEN__JWT__DECODE__SECRET": jwt,
    }
    template = (directory / ".env.example").read_text()
    lines = [line.split("=", 1)[0] + "=" + values[line.split("=", 1)[0]]
             if line.split("=", 1)[0] in values else line for line in template.splitlines()]
    with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as handle:
        handle.write("\n".join(lines) + "\n")
    print("Created ckan-docker/.env with generated credentials.")
    print("Admin username: ckan_admin. Read CKAN_SYSADMIN_PASSWORD in .env to sign in.")


if __name__ == "__main__":
    main()
