import os
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

# ここはプロジェクトに合わせて import パスを調整する可能性あり
# 多くの構成で app.main:app だが、app.py があるので app.py を試す
try:
    from app.main import app  # type: ignore
except Exception:  # pragma: no cover
    from app import main as _main  # type: ignore
    app = _main.app  # type: ignore

from app.db.session import get_db  # type: ignore
from app.models.billing import BillingDocumentORM  # type: ignore


def _utcnow():
    return datetime.now(timezone.utc)


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db_session():
    """
    get_db 依存をそのまま使う想定。
    もしSQLite(app.db)が使われているなら、テスト中にレコード追加してもOK。
    """
    gen = get_db()
    db = next(gen)
    try:
        yield db
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


def _create_doc(db, *, kind: str, status: str) -> uuid.UUID:
    doc_id = uuid.uuid4()
    now = _utcnow()
    doc = BillingDocumentORM(
        id=doc_id,
        store_id=None,
        kind=kind,
        status=status,
        doc_no=None,
        customer_name="Test",
        subtotal=1000,
        tax_total=100,
        total=1100,
        tax_rate=0.10,
        tax_mode="exclusive",
        tax_rounding="floor",
        issued_at=now if status == "issued" else None,
        source_work_order_id=None,
        meta={},
        created_at=now,
        updated_at=now,
    )
    db.add(doc)
    db.commit()
    return doc_id


BASE = "/api/v1"

def test_void_invoice_ok(client, db_session):
    doc_id = _create_doc(db_session, kind="invoice", status="issued")
    r = client.post(f"{BASE}/billing/{doc_id}/void", json={"reason": "mistake"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "void"


def test_void_requires_issued(client, db_session):
    doc_id = _create_doc(db_session, kind="invoice", status="draft")
    r = client.post(f"{BASE}/billing/{doc_id}/void", json={"reason": "mistake"})
    assert r.status_code == 400, r.text


def test_void_requires_invoice(client, db_session):
    doc_id = _create_doc(db_session, kind="estimate", status="issued")
    r = client.post(f"{BASE}/billing/{doc_id}/void", json={"reason": "mistake"})
    assert r.status_code == 400, r.text


def test_delete_blocks_issued(client, db_session):
    doc_id = _create_doc(db_session, kind="invoice", status="issued")
    r = client.delete(f"{BASE}/billing/{doc_id}")
    assert r.status_code == 400, r.text