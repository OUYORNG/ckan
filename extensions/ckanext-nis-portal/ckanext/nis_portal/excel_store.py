"""Durable import documents. Bootstrap is an explicit, idempotent migration."""
import json
from uuid import uuid4
from sqlalchemy import text
from ckan import model

def init_db():
    with model.meta.engine.begin() as conn:
        conn.execute(text('CREATE TABLE IF NOT EXISTS nis_excel_documents (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT NOT NULL, payload JSONB NOT NULL)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS nis_excel_owner ON nis_excel_documents(kind, owner)'))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS nis_excel_template_key ON nis_excel_documents (owner, (payload->>'match_key')) WHERE kind='template' AND coalesce((payload->>'enabled')::boolean,true)"))

def save(kind, owner, data, id=None):
    id = id or str(uuid4())
    data = dict(data, id=id)
    with model.meta.engine.begin() as conn:
        conn.execute(text('INSERT INTO nis_excel_documents VALUES (:id,:kind,:owner,CAST(:payload AS JSONB)) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload'), dict(id=id, kind=kind, owner=owner, payload=json.dumps(data, ensure_ascii=False)))
    return data

def get(id):
    with model.meta.engine.connect() as conn:
        row = conn.execute(text('SELECT payload FROM nis_excel_documents WHERE id=:id'), {'id': id}).first()
        if not row: raise KeyError('Import record not found')
        return row[0]

def listing(kind, owner):
    with model.meta.engine.connect() as conn:
        return [r[0] for r in conn.execute(text('SELECT payload FROM nis_excel_documents WHERE kind=:kind AND owner=:owner'), dict(kind=kind, owner=owner))]
