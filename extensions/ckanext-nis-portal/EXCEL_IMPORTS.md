# Excel imports

Open **Edit organization → Excel import templates tab**. Save a sheet matching name (for example `7A1`) and a resource name. Templates are isolated by organization. Header rows, columns, labels and data types are detected at import time; there is no column setup in the template editor. The existing 11A layouts are recognized automatically. Search, sort, page and edit templates in the shared dataset table layout.

Ambiguous headings, repeated sections, possible total rows and missing formula caches pause for review. The review screen retains extraction controls for resolving those exceptions. Existing manually mapped templates continue working until saved through the simplified editor, which switches them to automatic extraction.

Upload an XLSX under **Dataset → Add resource**, leaving **Automatically generate searchable data** selected. Existing original XLSX resources have **Generate searchable data**. External URLs are not fetched. Maximum compressed size is 30 MB, expanded size 200 MB, 100 sheets and 500,000 cells per sheet; jobs time out after ten minutes.

The import page displays sheet states, warnings, previews and extraction controls. Unexpected, hidden or mismatched sheets require review. Explicitly exclude extra sheets, or correct their mapping and mark them reviewed, then validate again. Collision checks cannot be bypassed by confirmation. Formula cells use cached values only; missing caches require opening and saving the source in Excel before uploading a new version.

Completed imports create a source snapshot and searchable tables. The original upload is retained. History links retain old resources; only current managed versions appear in the standard resource list. **Upload new version** targets an existing workbook series. A stale import cannot replace a newer current version. Source-file replacement is blocked for managed snapshots; metadata, dictionary labels and views remain editable. Administrators with direct native DataStore API access can still change rows; this is versioned import history, not a tamper-proof archive.

## Local deployment

Use the existing helper, whose Compose project name is `ckan-test`:

```sh
./ckan-docker/local-ckan up -d --build --wait ckan excel-worker datapusher
```

The CKAN initialization script runs the idempotent `nis-import init-db` storage migration and shares its generated configuration with the worker through a Docker volume. The worker uses the same image, CKAN storage and Redis configuration; it listens only to `nis-excel`. Do not remove the database/storage/config volumes.

Monitor with:

```sh
./ckan-docker/local-ckan logs --tail 100 excel-worker
```

Failed imports can be retried from their import page. Interrupted jobs become eligible for a manual retry after eleven minutes; the per-series lock prevents overlapping publication. The worker cleans recorded partial resources before retrying. Stop workers before maintenance to avoid interrupting active imports. Back up PostgreSQL and CKAN storage together; the storage contains source snapshots required for retry.

## Verification

Install openpyxl in your local Python environment, then run:

```sh
python3 -m unittest discover -s extensions/ckanext-nis-portal/tests -v
node frontend/tests/excel-import.cjs
node frontend/tests/template-organizations.cjs
npm run verify:portal
```

The integration check creates and deletes a temporary organization/dataset; it must run only against localhost. Parser fixtures use generated data, with optional local 11A originals for the 58/4/4 regression. Private originals must not be committed.
