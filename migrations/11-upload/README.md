# Information organization migration

Organization: http://localhost:5100/organization/ministry-of-information

Sign in with the existing `ckan_admin` account. The three datasets are private to authorized organization users and administrators.

| Dataset | Records |
| --- | ---: |
| 11A1 media statistics | 58 |
| 11A2 television and radio companies | 4 |
| 11A3 press companies | 4 |
| Total | 66 |

Each dataset contains an unmodified Excel workbook and a prepared JSON resource backed by CKAN DataStore, with a Table preview and a data dictionary. Table headers use the original Khmer labels. Original indicator codes remain API field names where supplied. File, sheet, and row references identify the source of each record.

## Try the portal

1. Open the organization, then select a dataset.
2. Open **ទិន្នន័យសម្រាប់ស្វែងរក / Searchable table**.
3. Enter a search and press **Enter**. For example, `2024` in 11A1 returns 19 records, `CTN` in 11A2 returns one, and `Fresh News` in 11A3 returns one.
4. Use the column search boxes, column visibility menu, or table download menu to explore and export data.
5. Open **Data API** for query examples or **Data Dictionary** for field definitions.
6. Select **ឯកសារដើម / Original Excel workbook**, then **Download**, to retrieve the original workbook.

## Source handling

- Only the three top-level 11A workbooks were imported. `24-Upload` was excluded as requested.
- The first 11A1 block has 19 records with no year label. Their year remains null. The next two blocks have 19 records labelled 2024 and 20 labelled 2023.
- Repeated indicator codes remain separate records, keyed by source row. The source code `11A5_1` is retained exactly.
- Khmer count text and units remain intact. Additional numeric columns are populated only for unambiguous single counts. Multi-count descriptions remain text.
- Revenue and expenditure are numeric; the source does not specify a currency, so none was assigned.
- Phone values are text. Source numeric cells have no recoverable leading zeroes, so none were added.
- The 11A3 source title says television/radio statistics, but the four company types are press. Both the original title and actual company types are retained, with the mismatch explained in the dataset description.
- CKAN automatic DataPusher formats are now limited to CSV. This prevents the formatted source workbooks, with merged headings and indicator rows, from being misread as ordinary data tables. Prepared JSON tables use explicit DataStore schemas.

## Verification and repeat imports

Verified all 66 DataStore records field by field, all original Excel downloads by SHA-256, authenticated organization search, CSV exports, and browser table previews/searches. The browser check reported no JavaScript errors or failed local HTTP requests. Repeating the import retained the same dataset/resource IDs and record counts.

`before-import.json` records the initial local catalog. `report.json` records dataset URLs, resource IDs, counts, and source hashes. Screenshots show the authenticated organization and table pages.

To repeat the same import:

```sh
# Run from the repository root after installing requirements.txt.
python3 migrations/11-upload/import_11a.py
npm ci
npm run verify:browser
```

The importer uses source-row keys to upsert records and reuses existing migration resources. It does not delete source rows if a future workbook becomes shorter; a count mismatch stops verification for review.
