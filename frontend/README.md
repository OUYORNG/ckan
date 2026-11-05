# React portal

The NIS interface uses React, TypeScript, React Router, Vite, Lucide icons, and self-hosted Inter and Noto Sans Khmer fonts. It renders the overview, catalog, organizations, dataset pages, table explorer, login, workspace, editors, organization membership, user administration, and account/API-token screens.

The production bundle is built in the CKAN Docker image and served by `ckanext-nis-portal` at the same origin as CKAN. There is no separate frontend server in production and no browser-held administrator API token.

## Run locally

The CKAN stack must have the `nis_portal` plugin installed and enabled. From the repository root:

```sh
python3 ckan-docker/enable-react.py
./ckan-docker/local-ckan up -d --build --wait ckan datapusher
```

Open http://localhost:5100. Existing users, organizations, resources, database volumes, API URLs, and private/public permissions continue to be provided by CKAN.

For frontend development with hot reload:

```sh
npm --prefix frontend ci
npm run dev:ui
```

Open the Vite URL printed by the command, normally http://127.0.0.1:5173. Vite proxies the session bridge and CKAN APIs to localhost:5100. Sign in separately in this browser origin if needed.

```sh
npm run build:ui
```

This checks TypeScript and produces `frontend/dist/`. Production image builds run these same checks and copy the generated bundle into the extension package.

## Authentication and authorization

- `/portal/api/session` returns the current user's profile, accessible organizations, and a CSRF token. It does not return API tokens or other users' details.
- The React login form authenticates through CKAN's authenticator and establishes the existing Flask/CKAN session cookie. Passwords are never stored in browser storage.
- Writes require a valid CSRF token and an authenticated account. CKAN action authorization and validation run on every call; UI visibility is not the permission boundary.
- `/portal/api/action/<action>` exposes an explicit list of read/write actions, not arbitrary backend function dispatch. Read actions use GET; writes use POST.
- Organization member management checks organization administration permissions. The portal user list requires a system administrator.
- API-token creation and revocation use the current user's CKAN permissions. A newly created token is shown only in the account screen's transient state.
- Authenticated bridge responses are not cached. Static bundles use fingerprinted filenames and long-lived caching.
- Native `/api/3/action/*`, file downloads, DataStore exports, and embedded resource views remain available. Password-recovery and external authentication routes remain handled by CKAN; the React login is intended for this installation's username/password authentication.

The server configuration, database maintenance, and extension installation remain deployment tasks. The React administration screen currently covers user creation and listing; it does not replace every CKAN sysadmin configuration tool.

## Verification

For the existing local test instance with the migrated 11A workbooks:

```sh
npm ci
npm run verify:browser
npm run verify:portal
```

`verify:browser` checks the imported organization, three table previews, and searches. `verify:portal` additionally checks anonymous/private access, CSRF, create/edit/upload flows, CSV export, API-token management, member/editor/outside-user permissions, desktop/mobile rendering, and JavaScript/server errors. It creates temporary QA users and data on localhost:5100 and cleans them up afterward. Do not point this test at production. Screenshots are written to ignored `frontend/test-results/`.

## Update an existing deployment

On the server, using this repository's existing Compose deployment:

```sh
cd /home/gic/product/ckan
git pull --ff-only
git submodule update --init --recursive
python3 ckan-docker/enable-react.py
./ckan-docker/local-ckan up -d --build --wait ckan datapusher
```

The enable helper adds `nis_portal` to the current plugin list without replacing credentials or other configuration. The image build needs access to npm and the Python package tooling in the CKAN base image. Existing reverse proxies continue routing to the CKAN application on port 5000 inside Docker; no new public port or DNS change is required.

To return to CKAN's built-in pages, remove `nis_portal` from `CKAN__PLUGINS` in the server's `.env`, then recreate the CKAN service with the same helper. Do not remove volumes or rerun the workbook import just to change the UI.
