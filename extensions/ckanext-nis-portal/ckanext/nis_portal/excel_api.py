import json
import click
from sqlalchemy.exc import IntegrityError
from flask import Blueprint, jsonify, request
from ckan.common import current_user
import ckan.plugins.toolkit as tk
from . import excel_store as store
from . import excel_engine as engine
from .excel_parser import key

@click.group('nis-import')
def commands():
    """Excel import storage migration and operations."""
@commands.command('init-db')
def initialize(): store.init_db(); click.echo('Excel import storage ready.')

def blueprint():
    from .plugin import context, protect_write, error
    bp = Blueprint('nis_excel', __name__)
    @bp.after_request
    def no_cache(response):
        response.headers['Cache-Control'] = 'no-store'; return response
    @bp.errorhandler(Exception)
    def failure(exc):
        if isinstance(exc, IntegrityError): return error('An active template already matches this sheet code.', 409)
        if isinstance(exc, tk.NotAuthorized): return error('Access denied.', 403)
        if isinstance(exc, (ValueError, KeyError, tk.ValidationError)): return error(str(exc), 400)
        if isinstance(exc, tk.ObjectNotFound): return error('Not found.', 404)
        raise exc
    def authorize_dataset(id, write=False):
        tk.check_access('package_update' if write else 'package_show', context(), {'id': id})
    @bp.route('/portal/api/excel/templates/<org>', methods=['GET', 'POST'])
    def templates(org):
        organization = tk.get_action('organization_show')(context(), {'id': org, 'include_datasets': False, 'include_users': False})
        if request.method == 'GET' and request.args.get('dataset'):
            package = tk.get_action('package_show')(context(), {'id': request.args['dataset']})
            authorize_dataset(package['id'], True)
            if package['owner_org'] != organization['id']: raise ValueError('Dataset belongs to another organization.')
        else:
            tk.check_access('organization_update', context(), {'id': organization['id']})
        if request.method == 'POST':
            failed = protect_write()
            if failed: return failed
            data = request.get_json() or {}
            if not isinstance(data, dict): raise ValueError('Template must be an object.')
            if not isinstance(data.get('sheet'), str) or not data['sheet'].strip(): raise ValueError('Sheet name is required.')
            if not isinstance(data.get('name'), str) or not data['name'].strip(): raise ValueError('Resource name is required.')
            automatic = data.get('auto', not data.get('columns') and not data.get('preset'))
            if automatic: data.update(columns=[], preset='')
            for existing in store.listing('template', organization['id']):
                if existing['id'] != data.get('id') and existing.get('enabled', True) and data.get('enabled', True) and key(existing['sheet']) == key(data['sheet']): raise ValueError('Another active template matches this sheet name.')
            old = store.get(data['id']) if data.get('id') else None
            if old and (old.get('org') != organization['id'] or not any(t['id'] == old['id'] for t in store.listing('template', organization['id']))): raise ValueError('Template belongs to another organization.')
            data = {k: data[k] for k in ('sheet','name','description','name_cell','description_cell','header','start','end','columns','enabled','preset','auto') if k in data}
            for field, default in {'columns': [], 'enabled': True, 'name': data['sheet'], 'description': '', 'header': 1, 'start': 2}.items(): data.setdefault(field, default)
            data['auto'] = bool(automatic)
            data.update(match_key=key(data['sheet']), org=organization['id'], revision=(old or {}).get('revision', 0) + 1)
            result = store.save('template', organization['id'], data, old['id'] if old else None)
            store.save('template_revision', result['id'], result)
            return jsonify(success=True, result=result)
        return jsonify(success=True, result=[dict(columns=[], enabled=True, name=t['sheet'], description='', header=1, start=2) | t for t in store.listing('template', organization['id'])])
    @bp.route('/portal/api/excel/start', methods=['POST'])
    def start():
        failed = protect_write()
        if failed: return failed
        data = request.get_json() or {}
        return jsonify(success=True, result=engine.start(current_user.name, data['resource'], data.get('series')))
    @bp.route('/portal/api/excel/dataset/<id>')
    def history(id):
        authorize_dataset(id)
        return jsonify(success=True, result={'series': store.listing('series', id), 'jobs': store.listing('job', id)})
    @bp.route('/portal/api/excel/job/<id>', methods=['GET', 'POST'])
    def job(id):
        record = store.get(id)
        authorize_dataset(record['package'], request.method == 'POST')
        if request.method == 'POST':
            failed = protect_write()
            if failed: return failed
            if record['state'] not in ('needs_review', 'failed'):
                from datetime import datetime, timezone
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(record.get('updated', record['created']))).total_seconds()
                if record['state'] == 'completed' or age < 660: raise ValueError('Only failed, reviewed, or stalled imports can be retried.')
            data = request.get_json() or {}
            decisions = data.get('decisions', record.get('decisions', {}))
            if not isinstance(decisions, dict): raise ValueError('Invalid sheet decisions.')
            engine.update(record, decisions=decisions, state='queued')
            engine.enqueue(record)
        return jsonify(success=True, result=record)
    return bp
