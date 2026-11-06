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

The desktop header toggle collapses the sidebar to navigation icons and expands it back. The browser remembers this layout preference across pages and reloads. Hovering over the collapsed sidebar temporarily expands it over the page without moving content or changing the saved preference. Keyboard focus also reveals the full navigation. Icon links retain accessible names and hover titles. Mobile navigation continues to use the full-width drawer, with Escape and link navigation closing it. The header is 64px tall on desktop and 56px on mobile.

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

## Resource management

Dataset editing also includes the source URL, version, author/maintainer names and emails, and editable custom metadata. Existing custom metadata is loaded into the form, including migration provenance. Dataset information displays these fields after saving. The header’s **Edit organization** button opens organization settings, following the dataset edit pattern. Settings support a logo URL or image upload, logo removal, and custom metadata; organization changes remain subject to CKAN administrator permissions.

Resource editors can open **Edit resource** from a resource page. Five tabs provide resource name, description, format and file editing; DataStore uploads and imports; the latest DataPusher upload log; field labels, descriptions and import type overrides; and preview view creation, configuration, ordering and deletion. CKAN enforces editor permissions for every operation.

Metadata-only edits preserve the existing file, provenance and table rows. Replacing the source file on the edit form changes the downloadable file; use the DataStore tab to import its rows. DataPusher accepts flat CSV, TSV and supported spreadsheets. The migrated JSON resources already have searchable tables; upload a flat CSV to replace their table data. Migration/API imports may have no DataPusher upload log. Dictionary type overrides apply on the next import.

## Organization dataset management

Organization administrators and system administrators use **Edit datasets** inside the organization's **Datasets** tab. It switches card view to rows and shows individual selection, selection of the current page (20 datasets), and confirmed bulk actions to make datasets public/private or delete them from the active catalog. **Done editing** exits selection mode. The native-compatible `/organization/bulk_process/<organization>` URL redirects to this same tab in edit mode; there is no separate management tab. Deletion uses CKAN's native soft deletion; it does not purge source files. The backend validates the whole selection and organization permissions before calling CKAN's bulk actions.

Card view is for browsing: it has no selection checkboxes or bulk action controls, and switching layouts clears selection. Search, pagination and sorting by title, last updated or creation date are available. Sorting is a display order, not a persisted manual dataset sequence. The catalog and organization browsing pages also support rows/cards and default to rows. Adding a dataset from organization management preselects that organization.

## Verification

For the existing local test instance with the migrated 11A workbooks:

```sh
npm ci
npm run verify:browser
npm run verify:portal
npm run verify:resources
npm run verify:organizations
npm run verify:sidebar
```

`verify:browser` checks the imported organization, three table previews, and searches. `verify:portal` additionally checks anonymous/private access, CSRF, create/edit/upload flows, dataset contacts/source/custom metadata and resource preservation, organization logo upload/removal, CSV export, API-token management, member/editor/outside-user permissions, desktop/mobile rendering, and JavaScript/server errors. It creates temporary QA users and data on localhost:5100 and cleans them up afterward. Do not point this test at production. Screenshots are written to ignored `frontend/test-results/`.

`verify:resources` checks metadata preservation, dictionary edits without changing rows or unique keys, view management and embedded previews, file replacement and DataPusher import/logs, editor permissions, and mobile layout. It creates and deletes temporary QA records on the local instance.

`verify:organizations` checks row/card behavior, page-scoped selection, confirmed visibility changes and deletion, search/sorting, resource and table preservation, permissions and CSRF, organization preselection, and mobile layouts using temporary QA records. The original imported datasets are only read during this check.

`verify:sidebar` checks collapse/expand, icon navigation, preference persistence, keyboard controls, mobile drawer behavior, and compact header dimensions without changing data.

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
