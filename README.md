# ckan

Local CKAN 2.11.7 data portal with Docker Compose and a Ministry of Information workbook importer.

## Setup

Install Git, Docker with Compose, and Python 3. Start Docker Desktop before starting the services.

```sh
git clone --recurse-submodules https://github.com/OUYORNG/ckan.git
cd ckan
python3 ckan-docker/setup-local.py
cd ckan-docker
./local-ckan up -d --build --wait ckan datapusher
```

For a clone made without submodules, run `git submodule update --init --recursive` first.

Open http://localhost:5100/user/login. The admin username is `ckan_admin`; read `CKAN_SYSADMIN_PASSWORD` in `ckan-docker/.env` for the generated password. The setup helper generates credentials and refuses to replace an existing `.env`.

The portal binds to localhost. Email delivery is not configured. CKAN, DataPusher, and Solr run with amd64 emulation on Apple Silicon.

## Start and stop

From `ckan-docker/`:

```sh
./local-ckan up -d --wait ckan datapusher
./local-ckan ps
./local-ckan logs --tail 100 ckan
./local-ckan stop
```

Named volumes preserve PostgreSQL data, search indexes, and uploaded files. `down -v` deletes the local test data.

The pinned source in `ckan/` is mounted into the application. After changing Python code, run `./local-ckan restart ckan`.

## Import the 11A workbooks

Source workbooks are local inputs and are excluded from Git. Place `11A_1.xlsx`, `11A2.xlsx`, and `11A3.xlsx` inside `11-upload/` at the repository root.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python migrations/11-upload/import_11a.py
```

The importer creates three private datasets under http://localhost:5100/organization/ministry-of-information. Each contains an original Excel file and a searchable DataStore table with Khmer labels and source row references. For the original supplied inputs, the tables contain 58, 4, and 4 records.

Read [the migration guide](migrations/11-upload/README.md) for mapping rules, source limitations, and repeat imports. Files under a nested `24-Upload` folder are not imported.

Optional browser verification requires Node.js 20+, Google Chrome, and the generated import report:

```sh
npm ci
npm run verify:browser
```

## Repository contents

- `ckan/`: upstream source pinned as a Git submodule at tag `ckan-2.11.7`.
- `ckan-docker/`: vendored upstream Docker setup, local Compose overlay, configuration generator, and startup helpers.
- `migrations/11-upload/`: importer, browser verifier, and migration documentation.

Credentials, source workbooks, generated data, catalog backups, reports, screenshots, logs, dependencies, and runtime files stay local through `.gitignore`. Databases and uploaded resources are not transferred by cloning this repository.

The local configuration automatically imports CSV through DataPusher. Formatted Excel originals are preserved as files; the workbook importer creates explicitly typed searchable tables.

## Upstream

See [THIRD_PARTY.md](THIRD_PARTY.md) for source revisions and licensing. Official installation guidance: https://docs.ckan.org/en/2.11/maintaining/installing/install-from-docker-compose.html
