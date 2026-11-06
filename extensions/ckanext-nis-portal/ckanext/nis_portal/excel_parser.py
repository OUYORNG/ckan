"""Bounded, deterministic workbook extraction; never evaluates formulas."""
import re
import unicodedata
import zipfile
from datetime import date, datetime
from decimal import Decimal
import openpyxl
from . import excel_presets

MAX_CELLS = 500000

def key(name):
    normalized = unicodedata.normalize('NFKC', name).strip().casefold()
    compact = ''.join(c for c in normalized if not c.isspace())
    if re.fullmatch(r'[a-z0-9]+', compact) and re.search('[a-z]', compact) and re.search('[0-9]', compact):
        return compact
    return normalized

def invisible(name):
    return any(unicodedata.category(c).startswith('C') and not c.isspace() for c in name)

def value(cell):
    if isinstance(cell, (date, datetime)): return cell.isoformat()
    if isinstance(cell, Decimal): return float(cell)
    return cell

def detect(sheet):
    """Detect a rectangular table after optional title rows; keep uncertainty explicit."""
    rows = [r for r in sheet if any(c.value is not None for c in r)]
    used = sorted({c.column for r in rows for c in r if c.value is not None})
    warnings = []
    candidate = None
    for row in rows[:40]:
        labels = [sheet.cell(row[0].row, column).value for column in used]
        if all(isinstance(v, str) and v.strip() for v in labels) and len({v.strip().casefold() for v in labels}) == len(labels):
            if any(merged.min_row <= row[0].row <= merged.max_row for merged in sheet.merged_cells.ranges): continue
            candidate = row[0].row; break
    if candidate is None:
        candidate = rows[0][0].row
        warnings.append('Could not identify unique column headings. Review the detected columns.')
    columns, ids = [], set()
    for index, column in enumerate(used):
        heading = str(sheet.cell(candidate, column).value or 'Column ' + str(index+1)).strip()
        identifier = re.sub('[^a-z0-9]+', '_', heading.casefold()).strip('_') or 'column_' + str(index+1)
        if identifier.startswith('source_'): identifier = 'data_' + identifier
        base = identifier
        suffix = 2
        while identifier in ids: identifier = base + '_' + str(suffix); suffix += 1
        ids.add(identifier)
        values = [sheet.cell(r[0].row,column).value for r in rows if r[0].row > candidate and sheet.cell(r[0].row,column).value is not None]
        kind = 'text'
        is_identifier = any(word in heading.casefold() for word in ('phone','telephone','postal','code','identifier','ទូរស័ព្ទ','កូដ')) or heading.casefold() in ('id','zip')
        if values and not is_identifier:
            if all(isinstance(v, (datetime,date)) for v in values): kind = 'timestamp'
            elif all(type(v) in (int,float) for v in values): kind = 'int' if all(float(v).is_integer() for v in values) else 'numeric'
        columns.append({'column':column,'id':identifier,'label':heading,'type':kind,'expected':str(sheet.cell(candidate,column).value or '')})
    headers = [sheet.cell(candidate,c).value for c in used]
    previous = candidate
    for row in rows:
        number = row[0].row
        if number <= candidate: continue
        if number > previous + 1: warnings.append('Multiple data sections or blank-row boundaries detected; review the extraction range.')
        values = [sheet.cell(number,c).value for c in used]
        if values == headers: warnings.append('Repeated header rows detected; review the data sections.')
        if any(isinstance(v,str) and v.strip().casefold() in ('total','subtotal','grand total','សរុប') for v in values): warnings.append('A possible total row needs review.')
        previous = number
    return {'header':candidate,'start':candidate+1,'columns':columns,'auto':False}, list(dict.fromkeys(warnings))

def extract(path, templates, decisions=None):
    decisions = decisions or {}
    with zipfile.ZipFile(path) as archive:
        if sum(i.file_size for i in archive.infolist()) > 200 * 1024 * 1024:
            raise ValueError('Expanded workbook exceeds 200 MB.')
    workbook = openpyxl.load_workbook(path, data_only=True, keep_links=False)
    formulas = openpyxl.load_workbook(path, data_only=False, keep_links=False)
    if len(workbook.worksheets) > 100: raise ValueError('At most 100 sheets are supported.')
    manifest, used = [], {}
    configured = {key(t['sheet']): t for t in templates if t.get('enabled', True)}
    for sheet in workbook:
        if sheet.max_row * sheet.max_column > MAX_CELLS: raise ValueError('Sheet exceeds 500,000 cells.')
        decision = decisions.get(sheet.title, {})
        item = {'sheet': sheet.title, 'key': key(sheet.title), 'state': 'needs_review', 'warnings': [], 'preview': [], 'fields': [], 'records': []}
        manifest.append(item)
        if decision.get('exclude'):
            item.update(state='excluded', reason='Explicitly excluded by editor'); continue
        raw = formulas[sheet.title]
        item['source_preview'] = [[value(c.value) for c in row] for row in raw.iter_rows(max_row=min(15, raw.max_row), max_col=min(20, raw.max_column))]
        populated = [r for r in raw if any(c.value is not None for c in r)]
        if not populated: item.update(state='empty', reason='No populated cells'); continue
        if invisible(sheet.title): item['warnings'].append('Sheet name contains invisible characters.')
        if sheet.sheet_state != 'visible': item['warnings'].append('Hidden sheet requires explicit inclusion.')
        template = decision.get('config') or configured.get(key(sheet.title))
        unmatched = template is None
        automatic = template is None or template.get('auto', not template.get('columns') and not template.get('preset'))
        template = dict({'columns': [], 'header':1, 'start':2, 'description':''}, **(template or {'sheet':sheet.title,'name':sheet.title}))
        if unmatched and configured: item['warnings'].append('No matching configured template; review the proposed extraction.')
        item['config'] = template
        item['name'] = template.get('name') or sheet.title
        item['description'] = template.get('description', '')
        target = key(template.get('sheet', sheet.title))
        if target in used:
            item['warnings'].append('Another included sheet maps to the same template.')
            used[target]['warnings'].append('Another included sheet maps to the same template.')
            used[target]['state'] = 'needs_review'
        used[target] = item
        try:
            if any(c.data_type == 'f' and sheet.cell(c.row,c.column).value is None for row in raw for c in row):
                raise ValueError('Formula has no cached value; open and save the workbook in Excel, then upload a new version.')
            for target in ('name', 'description'):
                reference = template.get(target + '_cell')
                if reference:
                    if raw[reference].data_type == 'f' and sheet[reference].value is None: raise ValueError('Metadata formula has no cached value: ' + reference)
                    item[target] = str(sheet[reference].value or '')
            codes = {str(c.value) for row in sheet.iter_rows(max_row=min(8, sheet.max_row)) for c in row if c.value is not None}
            preset = template.get('preset')
            if not preset and automatic:
                if any(c.startswith('11A2_') for c in codes): preset = '11A2'
                elif any(c.startswith('11A3_') for c in codes): preset = '11A3'
                elif any(c.startswith('11A_1_') for c in codes): preset = '11A1'
            if preset:
                if preset == '11A1': plan = excel_presets.summary(path, sheet)
                elif preset == '11A2': plan = excel_presets.companies(path, sheet, '11A2', 3, 4, 5, 2, 'Television and radio companies')
                elif preset == '11A3': plan = excel_presets.companies(path, sheet, '11A3', 2, 3, 4, 1, 'Press companies')
                else: raise ValueError('Unknown extraction preset.')
                if not plan['records']: raise ValueError('Preset found no records.')
                item.update(fields=plan['fields'], records=plan['records'], preview=plan['records'][:20], count=len(plan['records']))
                if decision.get('confirm') and not any('same template' in w for w in item['warnings']): item['warnings'] = []
                item['config'] = dict(template, preset=preset, auto=False)
                item['state'] = 'ready' if not item['warnings'] else 'needs_review'
                continue
            if automatic:
                detected, warnings = detect(sheet)
                template.update(detected)
                item['config'] = template
                item['warnings'].extend(warnings)
            for boundary in ('header','start','end'):
                configured_value = template.get(boundary)
                if configured_value is not None and (not isinstance(configured_value,int) or not 1 <= configured_value <= 1048576): raise ValueError('Row boundaries must be positive whole numbers.')
            columns = template.get('columns', [])
            if not columns: raise ValueError('Configure at least one column.')
            ids = [c['id'] for c in columns]
            if len(set(ids)) != len(ids) or any(not re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_]*', i) or i.startswith('source_') for i in ids):
                raise ValueError('Column IDs must be unique identifiers, not source_* names.')
            fields = [{'id': c['id'], 'type': c.get('type', 'text'), 'info': {'label': c.get('label', c['id']), 'notes': c.get('notes', '')}} for c in columns]
            fields += [{'id': 'source_sheet', 'type': 'text'}, {'id': 'source_row', 'type': 'int'}]
            for c in columns:
                if c.get('expected') and str(sheet.cell(int(template.get('header', 1)), int(c['column'])).value or '').strip() != c['expected'].strip():
                    item['warnings'].append('Header mismatch for ' + c['id'])
            records = []
            for row in range(int(template.get('start', 2)), min(int(template.get('end') or sheet.max_row), sheet.max_row) + 1):
                cells = [sheet.cell(row, int(c['column'])).value if not c.get('cell') else sheet[c['cell']].value for c in columns]
                if all(v is None for v in cells): continue
                record = {'source_sheet': sheet.title, 'source_row': row}
                for c, v in zip(columns, cells):
                    source = raw[c['cell']] if c.get('cell') else raw.cell(row, int(c['column']))
                    if source.data_type == 'f' and v is None: raise ValueError('Formula has no cached value at ' + source.coordinate)
                    kind = c.get('type', 'text')
                    if kind not in ('text', 'int', 'numeric', 'timestamp'): raise ValueError('Unsupported type: ' + kind)
                    if v is not None:
                        if kind == 'text': v = str(value(v))
                        elif kind == 'int':
                            if isinstance(v, bool) or Decimal(str(v)) != int(Decimal(str(v))): raise ValueError('Invalid integer at ' + source.coordinate)
                            v = int(Decimal(str(v)))
                        elif kind == 'numeric': v = float(Decimal(str(v)))
                        else:
                            if not isinstance(v, (datetime, date)): raise ValueError('Expected an Excel date at ' + source.coordinate)
                            v = v.isoformat()
                    record[c['id']] = v
                records.append(record)
            if not records: raise ValueError('No data rows in the configured range.')
            item.update(fields=fields, records=records, preview=records[:20])
            if decision.get('confirm') and not any('same template' in w for w in item['warnings']): item['warnings'] = []
            item['state'] = 'ready' if not item['warnings'] else 'needs_review'
        except (ValueError, KeyError, TypeError, ArithmeticError, AttributeError, IndexError) as exc:
            item['warnings'].append(str(exc)); item['state'] = 'needs_review'
    workbook.close(); formulas.close()
    return manifest
