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
        if not template:
            rows = [r for r in sheet if any(c.value is not None for c in r)]
            first = rows[0]
            headings = [c.value for c in first]
            simple = not sheet.merged_cells.ranges and all(isinstance(c, str) and c.strip() for c in headings) and len(set(headings)) == len(headings)
            template = {'sheet': sheet.title, 'name': sheet.title, 'header': first[0].row, 'start': first[0].row + 1,
                        'columns': [{'column': i + 1, 'id': 'column_' + str(i + 1), 'label': str(h or ''), 'expected': str(h or ''), 'type': 'text'} for i, h in enumerate(headings)]}
            if configured or not simple: item['warnings'].append('No matching configured template; review the proposed extraction.')
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
            if not preset and not decision.get('config') and not configured:
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
                item['warnings'] = [w for w in item['warnings'] if not w.startswith('No matching configured')]
                item['state'] = 'ready' if not item['warnings'] or decision.get('confirm') else 'needs_review'
                continue
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
