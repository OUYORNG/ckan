import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from sqlalchemy import text
from werkzeug.datastructures import FileStorage
import ckan.plugins.toolkit as tk
from ckan import model
from ckan.common import config
from ckan.lib.uploader import get_resource_uploader
from . import excel_store as store
from .excel_parser import extract

log = logging.getLogger(__name__)
def now(): return datetime.now(timezone.utc).isoformat()
def ctx(user):
    obj = model.User.get(user)
    if not obj or obj.state != 'active': raise ValueError('Import user is no longer active.')
    return {'user': obj.name, 'auth_user_obj': obj}
def action(user, name, data): return tk.get_action(name)(ctx(user), data)
def root():
    path = Path(config['ckan.storage_path']) / 'nis-excel'
    path.mkdir(parents=True, exist_ok=True)
    return path

def enqueue(job):
    tk.enqueue_job(run, [job['id']], queue='nis-excel', title='Excel import ' + job['id'], rq_kwargs={'timeout': 600})

def start(user, resource_id, series=None):
    resource = action(user, 'resource_show', {'id': resource_id})
    tk.check_access('resource_update', ctx(user), {'id': resource_id})
    if resource.get('url_type') != 'upload' or resource.get('format', '').lower() != 'xlsx':
        raise ValueError('Choose an uploaded XLSX resource, not an external link.')
    source = Path(get_resource_uploader(resource).get_path(resource_id))
    if source.stat().st_size > 30 * 1024 * 1024: raise ValueError('Workbook exceeds 30 MB.')
    package = action(user, 'package_show', {'id': resource['package_id']})
    previous = store.get(series) if series else None
    if previous and (previous.get('kind') != 'series' or previous['package'] != package['id']): raise ValueError('Version series belongs to another dataset.')
    source_bytes = source.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    templates = [t for t in store.listing('template', package['owner_org']) if t.get('enabled', True)]
    fingerprint = hashlib.sha256(json.dumps([digest, templates], sort_keys=True).encode()).hexdigest()
    for existing in store.listing('job', package['id']):
        if existing.get('fingerprint') == fingerprint and existing.get('series') == (series or existing['series']) and existing['state'] not in ('failed',): return existing
    if not previous:
        previous = store.save('series', package['id'], {'kind': 'series', 'package': package['id'], 'current': None, 'name': resource['name']})
    job = store.save('job', package['id'], {'kind': 'job', 'package': package['id'], 'org': package['owner_org'], 'user': user,
        'resource': resource_id, 'series': previous['id'], 'base': previous['current'], 'hash': digest, 'filename': resource['url'].rsplit('/',1)[-1], 'fingerprint': fingerprint,
        'templates': templates, 'state': 'queued', 'created': now(), 'logs': [], 'outputs': [], 'decisions': {}})
    (root() / (job['id'] + '.xlsx')).write_bytes(source_bytes)
    enqueue(job)
    return job

def update(job, **changes):
    if changes.get('state') and changes['state'] != job.get('state'):
        changes['logs'] = job.get('logs', []) + [now() + ' · ' + changes['state']]
    changes['updated'] = now()
    job.update(changes)
    store.save('job', job['package'], job, job['id'])

def run(id):
    job = store.get(id)
    # A session-level lock serializes retries and publication for this series.
    conn = model.meta.engine.connect()
    lock = 'nis-excel-' + job['series']
    conn.execute(text('SELECT pg_advisory_lock(hashtext(:key))'), {'key': lock})
    created = []
    try:
        job = store.get(id)
        if job['state'] == 'completed': return
        for previous in job.get('outputs', []):
            owned = tk.get_action('resource_show')({'ignore_auth': True}, {'id': previous})
            if owned.get('nis_import') == id: tk.get_action('resource_delete')({'ignore_auth': True}, {'id': previous})
        update(job, outputs=[])
        tk.check_access('package_update', ctx(job['user']), {'id': job['package']})
        update(job, state='extracting', error=None)
        manifest = extract(root() / (id + '.xlsx'), job['templates'], job.get('decisions'))
        for sheet in manifest:
            if sheet['fields'] and not any(field['id'] == 'source_file' for field in sheet['fields']): sheet['fields'].append({'id':'source_file','type':'text'})
            for row in sheet['records']:
                row['source_file'] = job.get('filename', 'original.xlsx')
        # Full records remain server-side; previews in the API are bounded.
        (root() / (id + '.json')).write_text(json.dumps(manifest, ensure_ascii=False, allow_nan=False))
        summary = [{k: v for k, v in sheet.items() if k != 'records'} | {'count': len(sheet['records'])} for sheet in manifest]
        update(job, manifest=summary)
        if any(s['state'] == 'needs_review' for s in manifest): update(job, state='needs_review'); return
        included = [s for s in manifest if s['state'] == 'ready']
        if not included: update(job, state='needs_review', error='Include at least one valid table.'); return
        series = store.get(job['series'])
        if series['current'] != job['base']: update(job, state='needs_review', error='A newer version is current. Start a new version from that version.'); return
        update(job, state='importing')
        # Preserve a managed original snapshot, including when the source is later replaced.
        with (root() / (id + '.xlsx')).open('rb') as handle:
            original = action(job['user'], 'resource_create', {'package_id': job['package'], 'name': 'Original Excel workbook', 'format': 'XLSX', 'nis_import': id, 'nis_series': job['series'], 'nis_role': 'original', 'source_sha256': job['hash'], 'upload': FileStorage(handle, filename='original.xlsx')})
        created.append(original['id']); update(job, outputs=list(created))
        for sheet in included:
            file = root() / (str(uuid4()) + '.json')
            file.write_text(json.dumps(sheet['records'], ensure_ascii=False))
            with file.open('rb') as handle:
                resource = action(job['user'], 'resource_create', {'package_id': job['package'], 'name': sheet['name'], 'description': sheet['description'], 'format': 'JSON', 'nis_import': id, 'nis_series': job['series'], 'nis_role': 'table', 'source_sha256': job['hash'], 'source_sheet': sheet['sheet'], 'upload': FileStorage(handle, filename='table.json')})
            created.append(resource['id']); update(job, outputs=list(created)); file.unlink()
            action(job['user'], 'datastore_create', {'resource_id': resource['id'], 'force': True, 'fields': sheet['fields']})
            for offset in range(0, len(sheet['records']), 1000):
                action(job['user'], 'datastore_upsert', {'resource_id': resource['id'], 'force': True, 'method': 'insert', 'records': sheet['records'][offset:offset+1000]})
            count = action(job['user'], 'datastore_search', {'resource_id': resource['id'], 'limit': 0})['total']
            if count != len(sheet['records']): raise ValueError('Imported record count differs from extracted record count.')
            action(job['user'], 'resource_view_create', {'resource_id': resource['id'], 'view_type': 'datatables_view', 'title': 'Table'})
        tk.check_access('package_update', ctx(job['user']), {'id': job['package']})
        series['current'] = id
        store.save('series', job['package'], series, series['id'])
        update(job, state='completed', outputs=created, completed=now(), logs=job['logs'] + ['Imported and validated all included tables.'])
    except Exception as exc:
        log.exception('Excel import failed: %s', id)
        for resource_id in created:
            try: action(job['user'], 'resource_delete', {'id': resource_id})
            except Exception: log.exception('Unable to remove partial resource %s', resource_id)
        update(job, state='failed', error=str(exc), outputs=[], logs=job['logs'] + [str(exc)])
    finally:
        conn.execute(text('SELECT pg_advisory_unlock(hashtext(:key))'), {'key': lock}); conn.close()
