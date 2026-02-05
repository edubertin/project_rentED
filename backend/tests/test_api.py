import os
import uuid

os.environ.setdefault("QUEUE_MODE", "inline")
os.environ.setdefault("AI_MODE", "mock")

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.auth import hash_password
from app.main import app
from app.models import (
    ActivityLog,
    Document,
    DocumentExtraction,
    Property,
    PropertyContract,
    Session,
    User,
    WorkOrder,
    WorkOrderInterest,
    WorkOrderProof,
    WorkOrderQuote,
    WorkOrderToken,
)
from app.worker import process_document_job


client = TestClient(app)


def _create_user(role: str, username: str | None = None, password: str | None = None) -> int:
    username = username or f"user{uuid.uuid4().hex[:8]}"
    password = password or "Test12345!"
    session = SessionLocal()
    try:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            name="Test User",
            cell_number="(000) 00000 0000",
            email=f"{username}@example.com",
            cpf="12345678901",
            extras={"name": "Test"},
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _cleanup_by_username(username: str) -> None:
    session = SessionLocal()
    try:
        user = session.execute(select(User).where(User.username == username)).scalar_one_or_none()
        if user:
            session.execute(delete(Session).where(Session.user_id == user.id))
            session.execute(delete(ActivityLog).where(ActivityLog.user_id == user.id))
            session.commit()
            prop_ids = (
                session.execute(select(Property.id).where(Property.owner_user_id == user.id))
                .scalars()
                .all()
            )
            if prop_ids:
                session.execute(
                    delete(PropertyContract).where(PropertyContract.property_id.in_(prop_ids))
                )
                doc_ids = (
                    session.execute(select(Document.id).where(Document.property_id.in_(prop_ids)))
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
                work_order_ids = (
                    session.execute(select(WorkOrder.id).where(WorkOrder.property_id.in_(prop_ids)))
                    .scalars()
                    .all()
                )
                if work_order_ids:
                    session.execute(
                        delete(WorkOrderToken).where(
                            WorkOrderToken.work_order_id.in_(work_order_ids)
                        )
                    )
                    session.execute(
                        delete(WorkOrderProof).where(
                            WorkOrderProof.work_order_id.in_(work_order_ids)
                        )
                    )
                    session.execute(
                        delete(WorkOrderQuote).where(
                            WorkOrderQuote.work_order_id.in_(work_order_ids)
                        )
                    )
                    session.execute(
                        delete(WorkOrderInterest).where(
                            WorkOrderInterest.work_order_id.in_(work_order_ids)
                        )
                    )
                    session.execute(delete(WorkOrder).where(WorkOrder.id.in_(work_order_ids)))
            session.execute(delete(Property).where(Property.id.in_(prop_ids)))
            session.execute(delete(User).where(User.id == user.id))
            session.commit()
    finally:
        session.close()


def _cleanup_test_admins() -> None:
    session = SessionLocal()
    try:
        usernames = (
            session.execute(
                select(User.username).where(User.role == "admin", User.username != "admin")
            )
            .scalars()
            .all()
        )
    finally:
        session.close()
    for username in usernames:
        _cleanup_by_username(username)


def test_healthcheck():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_auth_required():
    resp = client.get("/properties")
    assert resp.status_code == 401


def _login(username: str, password: str):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_login_with_username_password():
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    _create_user(role, username=username, password=password)
    resp = _login(username, password)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == username
    _cleanup_by_username(username)


def test_properties_crud():
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
    _login(username, password)
    resp = client.post(
        "/properties",
        json={
            "owner_user_id": user_id,
            "extras": {
                "tag": "Teste",
                "property_address": "Rua Teste, 123",
                "bedrooms": 2,
                "bathrooms": 1,
                "parking_spaces": 1,
                "is_rented": False,
                "desired_rent_value": 250000,
                "rent_currency": "BRL",
            },
        },
    )
    assert resp.status_code == 201
    prop_id = resp.json()["id"]

    resp = client.get("/properties")
    assert resp.status_code == 200
    assert any(item["id"] == prop_id for item in resp.json())

    resp = client.delete(f"/properties/{prop_id}")
    assert resp.status_code == 204
    _cleanup_by_username(username)


def test_work_order_create_quote():
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
    _login(username, password)
    prop = client.post(
        "/properties",
        json={
            "owner_user_id": user_id,
            "extras": {
                "tag": "WO",
                "property_address": "Rua Teste, 99",
                "bedrooms": 1,
                "bathrooms": 1,
                "parking_spaces": 1,
                "is_rented": False,
                "desired_rent_value": 150000,
                "rent_currency": "BRL",
            },
        },
    ).json()
    resp = client.post(
        "/work-orders",
        json={
            "property_id": prop["id"],
            "type": "quote",
            "title": "Fix leaking pipe",
            "description": "Need repair in kitchen sink.",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["work_order"]["status"] == "quote_requested"
    assert "portal" in data["portal_links"]
    _cleanup_by_username(username)


def test_work_order_delete():
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
    _login(username, password)
    prop = client.post(
        "/properties",
        json={
            "owner_user_id": user_id,
            "extras": {
                "tag": "WO",
                "property_address": "Rua Teste, 101",
                "bedrooms": 1,
                "bathrooms": 1,
                "parking_spaces": 1,
                "is_rented": False,
                "desired_rent_value": 150000,
                "rent_currency": "BRL",
            },
        },
    ).json()
    created = client.post(
        "/work-orders",
        json={
            "property_id": prop["id"],
            "type": "quote",
            "title": "Delete test",
            "description": "Delete work order.",
        },
    ).json()
    work_order_id = created["work_order"]["id"]
    resp = client.delete(f"/work-orders/{work_order_id}")
    assert resp.status_code == 200
    _cleanup_by_username(username)


def test_document_upload_and_process(tmp_path):
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
    _login(username, password)
    prop = client.post(
        "/properties",
        json={
            "owner_user_id": user_id,
            "extras": {
                "tag": "Docs",
                "property_address": "Rua Teste, 456",
                "bedrooms": 1,
                "bathrooms": 1,
                "parking_spaces": 0,
                "is_rented": False,
                "desired_rent_value": 200000,
                "rent_currency": "BRL",
            },
        },
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
    _cleanup_by_username(username)


def test_worker_pipeline(tmp_path):
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
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
        _cleanup_by_username(username)


def test_review_document(tmp_path):
    role = "admin"
    username = f"admin{uuid.uuid4().hex[:8]}"
    password = "Admin12345!"
    user_id = _create_user(role, username=username, password=password)
    _login(username, password)
    prop = client.post(
        "/properties",
        json={
            "owner_user_id": user_id,
            "extras": {
                "tag": "Review",
                "property_address": "Rua Teste, 789",
                "bedrooms": 3,
                "bathrooms": 2,
                "parking_spaces": 2,
                "is_rented": False,
                "desired_rent_value": 300000,
                "rent_currency": "BRL",
            },
        },
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
    _cleanup_by_username(username)


def test_admin_create_user_and_delete():
    admin_username = f"admin{uuid.uuid4().hex[:8]}"
    admin_password = "Admin12345!"
    _create_user("admin", username=admin_username, password=admin_password)
    _login(admin_username, admin_password)

    resp = client.post(
        "/users",
        json={
            "username": f"user{uuid.uuid4().hex[:6]}",
            "password": "User12345!",
            "role": "property_owner",
            "name": "Test Owner",
            "cell_number": "(111) 11111 1111",
            "email": "owner@example.com",
            "cpf": "98765432100",
            "extras": {},
        },
    )
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    delete_resp = client.delete(f"/users/{user_id}")
    assert delete_resp.status_code == 204
    _cleanup_by_username(admin_username)
    _cleanup_test_admins()


def test_event_logs_endpoint():
    admin_username = f"admin{uuid.uuid4().hex[:8]}"
    admin_password = "Admin12345!"
    _create_user("admin", username=admin_username, password=admin_password)
    _login(admin_username, admin_password)

    resp = client.get("/event-logs")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    _cleanup_by_username(admin_username)
