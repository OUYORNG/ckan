"""Enable the React portal without replacing existing CKAN configuration."""

from pathlib import Path


def main():
    path = Path(__file__).resolve().parent / ".env"
    if not path.exists():
        raise SystemExit("No .env found. Run setup-local.py for a new installation first.")
    lines = path.read_text().splitlines()
    for index, line in enumerate(lines):
        if line.startswith("CKAN__PLUGINS="):
            plugins = line.split("=", 1)[1].strip().strip("\"'").split()
            if "nis_portal" in plugins:
                print("The React portal is already enabled.")
                return
            lines[index] = 'CKAN__PLUGINS="' + " ".join([*plugins, "nis_portal"]) + '"'
            path.write_text("\n".join(lines) + "\n")
            print("Enabled nis_portal; existing configuration was preserved. Rebuild the CKAN image to apply.")
            return
    raise SystemExit("CKAN__PLUGINS is missing from .env. Add nis_portal to your existing plugin list before restarting.")


if __name__ == "__main__":
    main()
