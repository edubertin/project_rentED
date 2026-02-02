import os
import uuid

os.environ.setdefault("QUEUE_MODE", "inline")
os.environ.setdefault("AI_MODE", "mock")

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import Document, DocumentExtraction, Property, User, WorkOrder
from app.worker import process_document_job


client = TestClient(app)


def _create_user(role: str) -> int:
    session = SessionLocal()
    try:
        user = User(role=role, extras={"name": "Test"})
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _cleanup_by_role(role: str) -> None:
    session = SessionLocal()
    try:
        user = session.execute(select(User).where(User.role == role)).scalar_one_or_none()
        if user:
            prop_ids = (
                session.execute(
                    select(Property.id).where(Property.owner_user_id == user.id)
                )
                .scalars()
                .all()
            )
            if prop_ids:
                doc_ids = (
                    session.execute(
                        select(Document.id).where(Document.property_id.in_(prop_ids))
                    )
                    .scalars()
                    .all()
                )
                if doc_ids:
                    session.execute(
                        delete(DocumentExtraction).where(
                            DocumentExtraction.document_id.in_(doc_ids)
                        )
                    )
                    session.execute(delete(Document).where(Document.id.in_(doc_ids)))
                session.execute(delete(WorkOrder).where(WorkOrder.property_id.in_(prop_ids)))
                session.execute(delete(Property).where(Property.id.in_(prop_ids)))
            session.execute(delete(User).where(User.id == user.id))
            session.commit()
    finally:
        session.close()


def test_healthcheck():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_with_role():
    role = f"test_admin_{uuid.uuid4().hex}"
    _create_user(role)
    resp = client.post("/auth/login", json={"role": role})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    _cleanup_by_role(role)


def test_create_user():
    role = f"test_user_{uuid.uuid4().hex}"
    resp = client.post("/users", json={"role": role, "extras": {"name": "Test"}})
    assert resp.status_code == 201
    user_id = resp.json()["id"]
    session = SessionLocal()
    try:
        db_user = session.get(User, user_id)
        assert db_user is not None
    finally:
        session.close()
        _cleanup_by_role(role)


def test_properties_crud():
    role = f"test_owner_{uuid.uuid4().hex}"
    user_id = _create_user(role)
    resp = client.post(
        "/properties",
        json={"owner_user_id": user_id, "extras": {"label": "Teste"}},
    )
    assert resp.status_code == 201
    prop_id = resp.json()["id"]

    resp = client.get("/properties")
    assert resp.status_code == 200
    assert any(item["id"] == prop_id for item in resp.json())

    resp = client.delete(f"/properties/{prop_id}")
    assert resp.status_code == 204
    _cleanup_by_role(role)


def test_document_upload_and_process(tmp_path):
    role = f"test_docs_{uuid.uuid4().hex}"
    user_id = _create_user(role)
    prop = client.post(
        "/properties",
        json={"owner_user_id": user_id, "extras": {"label": "Docs"}},
    ).json()
    file_path = tmp_path / "doc.txt"
    file_path.write_text("conteudo")

    with open(file_path, "rb") as handle:
        resp = client.post(
            "/documents/upload",
            params={"property_id": prop["id"]},
            files={"file": ("doc.txt", handle, "text/plain")},
        )
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["extras"]["status"] == "uploaded"

    resp = client.post(f"/documents/{doc['id']}/process")
    assert resp.status_code == 200
    assert resp.json()["status"] == "needs_review"

    # cleanup stored file
    stored_path = doc["extras"]["path"]
    if stored_path and os.path.exists(stored_path):
        os.remove(stored_path)
    _cleanup_by_role(role)


def test_worker_pipeline(tmp_path):
    role = f"test_worker_{uuid.uuid4().hex}"
    user_id = _create_user(role)
    session = SessionLocal()
    try:
        prop = Property(owner_user_id=user_id, extras={"label": "Worker"})
        session.add(prop)
        session.commit()
        session.refresh(prop)

        file_path = tmp_path / "worker.txt"
        file_path.write_text("worker-data")

        doc = Document(
            property_id=prop.id,
            extras={"path": str(file_path), "status": "uploaded", "name": "worker.txt"},
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        doc_id = doc.id
    finally:
        session.close()

    process_document_job(doc_id)

    session = SessionLocal()
    try:
        doc = session.get(Document, doc_id)
        assert doc.extras["status"] == "needs_review"
        extraction = session.execute(
            select(DocumentExtraction).where(DocumentExtraction.document_id == doc_id)
        ).scalar_one_or_none()
        assert extraction is not None
        assert extraction.extras.get("text") is not None
    finally:
        session.close()
        _cleanup_by_role(role)


def test_review_document(tmp_path):
    role = f"test_review_{uuid.uuid4().hex}"
    user_id = _create_user(role)
    prop = client.post(
        "/properties",
        json={"owner_user_id": user_id, "extras": {"label": "Review"}},
    ).json()
    file_path = tmp_path / "review.txt"
    file_path.write_text("review-data")

    with open(file_path, "rb") as handle:
        resp = client.post(
            "/documents/upload",
            params={"property_id": prop["id"]},
            files={"file": ("review.txt", handle, "text/plain")},
        )
    assert resp.status_code == 201
    doc_id = resp.json()["id"]

    extraction_resp = client.get(f"/documents/{doc_id}/extraction")
    assert extraction_resp.status_code == 200
    extraction = extraction_resp.json()["extras"]

    review_resp = client.put(
        f"/documents/{doc_id}/review",
        json={"extraction": extraction},
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["extras"]["status"] == "confirmed"

    stored_path = resp.json()["extras"]["path"]
    if stored_path and os.path.exists(stored_path):
        os.remove(stored_path)
    _cleanup_by_role(role)
