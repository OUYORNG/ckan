"""Import the three 11A workbooks into the local CKAN test portal."""

import hashlib
import csv
import io
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
import requests


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
BASE = "http://localhost:5100"
MARKER = "11-upload-11a-v1"
ORG = "ministry-of-information"
DIGITS = str.maketrans("០១២៣៤៥៦៧៨៩", "0123456789")


def field(key, label, kind="text", notes=""):
    return {"id": key, "type": kind, "info": {"label": label, "notes": notes}}


def count_value(value):
    if value is None:
        return None
    match = re.fullmatch(r"\s*([0-9]+)\s*(?:ស្ថានីយ|អង្គភាព)\s*", str(value).translate(DIGITS))
    return int(match[1]) if match else None


def summary():
    path = ROOT / "11-upload/11A_1.xlsx"
    sheet = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    fields = [
        field("source_block", "ប្លុកទិន្នន័យ / Source block", "int"),
        field("year", "ឆ្នាំ / Year", "int", "Blank in the first source block. No year inferred."),
        field("section", "ផ្នែក / Section"),
        field("indicator_code", "កូដសូចនាករ / Indicator code", notes="Original codes retained, including 11A5_1. Codes repeat across blocks."),
        field("item_number", "ល.រ", "int"),
        field("indicator", "ឈ្មោះ"),
        field("phnom_penh", "រាជធានីភ្នំពេញ", notes="Original Khmer text and units."),
        field("relay_stations", "ស្ថានីយ៍ផ្សាយបន្ត", notes="Original text. May combine direct broadcasts, provinces and relay stations."),
        field("total", "សរុប", notes="Original Khmer text and units. Missing remains null."),
        field("other", "ផ្សេងៗ"),
        field("phnom_penh_count", "Phnom Penh count", "int", "Derived only when the source contains one count and a station or organization unit."),
        field("relay_station_count", "Relay station count", "int", "Multi-count text is left null. See the original relay_stations field."),
        field("total_count", "Total count", "int", "Khmer digits converted to a number; no missing values filled."),
        field("source_block_title", "Source block title"),
        field("source_file", "Source file"),
        field("source_sheet", "Source sheet"),
        field("source_row", "Source row", "int"),
    ]
    records = []
    block, year, title, section = 1, None, None, None
    for row in sheet.iter_rows(min_row=2):
        n = row[0].row
        a, b, c, d, e, f, g = [cell.value for cell in row[:7]]
        if a is None and isinstance(b, str) and "ឆ្នាំ" in b:
            block += 1
            title = b
            match = re.search(r"ឆ្នាំ\s*([0-9]{4})", b.translate(DIGITS))
            if not match:
                raise ValueError(f"Unrecognized year at row {n}")
            year = int(match[1])
        elif a and isinstance(b, str) and c is None:
            section = b
        elif a and c is not None:
            records.append(dict(zip([x["id"] for x in fields], [
                block, year, section, a, b, c, d, e, f, g,
                count_value(d), count_value(e), count_value(f), title,
                path.name, sheet.title, n,
            ])))
        elif any(cell.value is not None for cell in row):
            raise ValueError(f"Unclassified source row {n}")
    assert Counter(r["source_block"] for r in records) == {1: 19, 2: 19, 3: 20}
    return {
        "path": path, "name": "moi-11a1-media-statistics",
        "title": "11A1 — ស្ថិតិប្រព័ន្ធផ្សព្វផ្សាយរបស់ក្រសួងព័ត៌មាន / Media statistics",
        "fields": fields, "records": records,
        "notes": "Media statistics from the supplied 11A_1 workbook.\n\n"
        "58 indicator records across three source blocks: 19 with no year label, 19 labelled 2024, and 20 labelled 2023. "
        "The first block's year remains blank. Repeated indicator codes are preserved using source_row as the record key. "
        "Original Khmer values, units, headings, source codes and missing values are retained. "
        "Numeric count columns are derived only from unambiguous single-count cells. "
        "The source code 11A5_1 is preserved as supplied. No cross-year category equivalence is assumed.",
    }


def companies(filename, code, header_row, code_row, start_row, offset, english):
    path = ROOT / "11-upload" / filename
    sheet = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    fields = [field("year", "ឆ្នាំ / Year", "int"), field("company_name", sheet.cell(header_row, offset).value)]
    for index in range(4):
        column = offset + index + 1
        fields.append(field(sheet.cell(code_row, column).value, sheet.cell(header_row, column).value,
                            "numeric" if index in (1, 2) else "text",
                            "Currency/unit is not specified in the workbook." if index in (1, 2) else
                            "Kept as text. The workbook stores this as a number, so no leading zero has been invented." if index == 3 else ""))
    fields += [field("source_file", "Source file"), field("source_sheet", "Source sheet"), field("source_row", "Source row", "int")]
    if offset == 2:
        fields.append(field("item_number", sheet.cell(header_row, 1).value, "int"))
    records = []
    for n in range(start_row, sheet.max_row + 1):
        values = [sheet.cell(n, offset + k).value for k in range(5)]
        if not any(v is not None for v in values):
            continue
        values[-1] = None if values[-1] is None else str(values[-1])
        prepared_values = [2024, *values, path.name, sheet.title, n]
        if offset == 2:
            prepared_values.append(sheet.cell(n, 1).value)
        records.append(dict(zip([x["id"] for x in fields], prepared_values)))
    assert len(records) == 4
    notes = f"{english} from the supplied {filename}, reporting year 2024 as stated in the workbook title. "
    notes += "All four records and original indicator codes are retained. Annual revenue and expenditure are numeric, but no currency is assumed. "
    notes += "Phone values are stored as text exactly as supplied; original numeric cells do not preserve leading zeroes."
    if code == "11A3":
        notes += " The source title says television/radio statistics, while all four source company types are សារព័ត៌មាន (press). This mismatch is retained and documented."
    return {"path": path, "name": f"moi-{code.lower()}-companies-2024", "title": f"{code} — {sheet.cell(1, 2).value} / {english}", "fields": fields, "records": records, "notes": notes}


def main():
    plans = [summary(), companies("11A2.xlsx", "11A2", 3, 4, 5, 2, "Television and radio companies"),
             companies("11A3.xlsx", "11A3", 2, 3, 4, 1, "Press companies")]
    assert sum(len(p["records"]) for p in plans) == 66
    for plan in plans:
        plan["sha256"] = hashlib.sha256(plan["path"].read_bytes()).hexdigest()
        (OUT / (plan["name"] + ".json")).write_text(json.dumps(plan["records"], ensure_ascii=False, indent=2) + "\n")
    result = subprocess.run([str(ROOT / "ckan-docker/local-ckan"), "exec", "-T", "ckan", "ckan", "-c", "/srv/app/ckan.ini", "user", "token", "add", "ckan_admin", MARKER], capture_output=True, text=True, check=True)
    token = next(line.strip() for line in result.stdout.splitlines() if line.strip().startswith("eyJ"))
    session = requests.Session()
    session.headers["Authorization"] = token

    def action(name, data, missing_ok=False):
        response = session.post(BASE + "/api/3/action/" + name, json=data, timeout=60)
        payload = response.json()
        if not payload.get("success"):
            if missing_ok and payload.get("error", {}).get("__type") == "Not Found Error":
                return None
            raise RuntimeError(f"{name}: {response.status_code}: {payload}")
        return payload["result"]

    backup = OUT / "before-import.json"
    if not backup.exists():
        backup.write_text(json.dumps({"organizations": action("organization_list", {"all_fields": True}),
                                     "datasets": action("package_search", {"include_private": True, "rows": 1000})}, ensure_ascii=False, indent=2) + "\n")
        backup.chmod(0o600)
    organization = action("organization_show", {"id": ORG}, missing_ok=True)
    if not organization:
        organization = action("organization_create", {"name": ORG, "title": "ក្រសួងព័ត៌មាន / Ministry of Information",
            "description": "Information and media statistics imported from the supplied 11A workbooks for local CKAN testing. Source workbooks and prepared tables are available in each dataset.",
            "extras": [{"key": "migration_source", "value": MARKER}]})
    report = {"imported_at": datetime.now(timezone.utc).isoformat(), "organization_url": BASE + "/organization/" + ORG,
              "scope": "Three top-level 11A workbooks only. 24-Upload excluded.", "datasets": []}
    for plan in plans:
        existing = action("package_show", {"id": plan["name"]}, missing_ok=True)
        if existing and not any(x["key"] == "migration_source" and x["value"] == MARKER for x in existing.get("extras", [])):
            raise RuntimeError(f"Refusing to modify unrelated dataset {plan['name']}")
        metadata = {"name": plan["name"], "title": plan["title"], "owner_org": organization["id"], "private": True,
            "notes": plan["notes"], "license_id": "notspecified", "tags": [{"name": x} for x in ["information", "media", "Cambodia", "11A"]],
            "extras": [{"key": "migration_source", "value": MARKER}, {"key": "source_file", "value": plan["path"].name},
                       {"key": "source_sha256", "value": plan["sha256"]}, {"key": "prepared_records", "value": str(len(plan["records"]))}]}
        if existing:
            metadata["id"] = existing["id"]
        package = action("package_patch" if existing else "package_create", metadata)

        def upload(path, role, name, fmt, description):
            resource = next((r for r in package["resources"] if r.get("migration_role") == role), None)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if resource and resource.get("source_sha256") == digest:
                return resource
            data = {"package_id": package["id"], "name": name, "format": fmt, "description": description,
                    "migration_role": role, "source_sha256": digest, "mimetype": "application/json" if fmt == "JSON" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
            if resource:
                data["id"] = resource["id"]
            with path.open("rb") as handle:
                response = session.post(BASE + "/api/3/action/" + ("resource_update" if resource else "resource_create"), data=data,
                                        files={"upload": (path.name, handle, data["mimetype"])}, timeout=60)
            payload = response.json()
            if not payload.get("success"):
                raise RuntimeError(f"Upload failed: {payload}")
            return payload["result"]

        prepared = upload(OUT / (plan["name"] + ".json"), "prepared", "ទិន្នន័យសម្រាប់ស្វែងរក / Searchable table", "JSON",
                          "Prepared records with Khmer labels, explicit field types, and source row references. Use Table to browse, Data API to query, or the table export menu for CSV.")
        action("datastore_create", {"resource_id": prepared["id"], "fields": plan["fields"], "primary_key": ["source_row"], "force": True})
        action("datastore_upsert", {"resource_id": prepared["id"], "records": plan["records"], "method": "upsert", "force": True, "calculate_record_count": True})
        views = action("resource_view_list", {"id": prepared["id"]})
        if not any(v["view_type"] == "datatables_view" for v in views):
            action("resource_view_create", {"resource_id": prepared["id"], "view_type": "datatables_view", "title": "Table", "description": "Browse and filter the imported records."})
        original = upload(plan["path"], "original", "ឯកសារដើម / Original Excel workbook", "XLSX",
                          "Unmodified source workbook, preserved byte-for-byte. Use the prepared table for searching and filtering.")
        stored = action("datastore_search", {"resource_id": prepared["id"], "limit": 1000, "sort": "source_row"})
        assert stored["total"] == len(plan["records"]), (plan["name"], stored["total"])
        for expected, actual in zip(plan["records"], stored["records"]):
            for key, value in expected.items():
                assert actual[key] == value, (plan["name"], expected["source_row"], key, value, actual[key])
        download = session.get(original["url"], timeout=60)
        download.raise_for_status()
        assert hashlib.sha256(download.content).hexdigest() == plan["sha256"]
        export = session.get(BASE + "/datastore/dump/" + prepared["id"], params={"format": "csv"}, timeout=60)
        export.raise_for_status()
        assert len(list(csv.DictReader(io.StringIO(export.content.decode("utf-8-sig"))))) == len(plan["records"])
        if plan is plans[0]:
            assert action("datastore_search", {"resource_id": prepared["id"], "filters": {"year": 2024}, "limit": 1})["total"] == 19
        item = {"name": plan["name"], "title": plan["title"], "rows": len(plan["records"]), "source_file": plan["path"].name,
                "source_sha256": plan["sha256"], "dataset_url": BASE + "/dataset/" + plan["name"],
                "table_url": BASE + "/dataset/" + plan["name"] + "/resource/" + prepared["id"],
                "table_resource_id": prepared["id"], "original_resource_id": original["id"], "private": True}
        report["datasets"].append(item)
        (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(f"Verified {plan['name']}: {len(plan['records'])} records, original download matches SHA-256")
    found = action("package_search", {"fq": "organization:" + ORG, "include_private": True, "rows": 100})
    assert {p["name"] for p in plans}.issubset({p["name"] for p in found["results"]})
    report["total_records"] = sum(d["rows"] for d in report["datasets"])
    report["organization_search_verified"] = True
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(report["organization_url"])


if __name__ == "__main__":
    main()
