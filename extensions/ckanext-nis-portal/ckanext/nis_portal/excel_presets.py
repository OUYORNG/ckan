import re
from collections import Counter
DIGITS = str.maketrans("០១២៣៤៥៦៧៨៩", "0123456789")

def field(key, label, kind="text", notes=""):
    return {"id": key, "type": kind, "info": {"label": label, "notes": notes}}

def count_value(value):
    if value is None:
        return None
    match = re.fullmatch(r"\s*([0-9]+)\s*(?:ស្ថានីយ|អង្គភាព)\s*", str(value).translate(DIGITS))
    return int(match[1]) if match else None

def summary(path, sheet):
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

def companies(path, sheet, code, header_row, code_row, start_row, offset, english):
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
    title = str(sheet.cell(1, 2).value or "").translate(DIGITS)
    match = re.search(r"(?:19|20)[0-9]{2}", title)
    reporting_year = int(match[0]) if match else None
    records = []
    for n in range(start_row, sheet.max_row + 1):
        values = [sheet.cell(n, offset + k).value for k in range(5)]
        if not any(v is not None for v in values):
            continue
        values[-1] = None if values[-1] is None else str(values[-1])
        prepared_values = [reporting_year, *values, path.name, sheet.title, n]
        if offset == 2:
            prepared_values.append(sheet.cell(n, 1).value)
        records.append(dict(zip([x["id"] for x in fields], prepared_values)))
    notes = f"{english} from the supplied {path.name}, reporting year 2024 as stated in the workbook title. "
    notes += "All four records and original indicator codes are retained. Annual revenue and expenditure are numeric, but no currency is assumed. "
    notes += "Phone values are stored as text exactly as supplied; original numeric cells do not preserve leading zeroes."
    if code == "11A3":
        notes += " The source title says television/radio statistics, while all four source company types are សារព័ត៌មាន (press). This mismatch is retained and documented."
    return {"path": path, "name": f"moi-{code.lower()}-companies-2024", "title": f"{code} — {sheet.cell(1, 2).value} / {english}", "fields": fields, "records": records, "notes": notes}
