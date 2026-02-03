import uuid
from datetime import datetime, timezone
from pathlib import Path

import re

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import (
    cookie_name,
    cookie_secure,
    hash_password,
    new_session_id,
    session_expiry,
    verify_password,
)
from app.deps import get_current_user, get_db, get_optional_user, require_admin
from app.models import ActivityLog, Document, DocumentExtraction, Property, Session as UserSession, User, WorkOrder
from app.queue import is_inline_mode, try_enqueue
from app.schemas import (
    DocumentOut,
    DocumentProcessResponse,
    DocumentExtractionOut,
    DocumentReviewRequest,
    LoginRequest,
    LoginResponse,
    AuthMeResponse,
    PropertyCreate,
    PropertyOut,
    PropertyUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
    WorkOrderCreate,
    WorkOrderOut,
)
from app.storage import get_upload_dir
from app.worker import process_document_job

app = FastAPI(
    title="rentED API",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

ALLOWED_ROLES = {
    "admin",
    "real_estate",
    "finance",
    "service_provider",
    "property_owner",
}


def _valid_cell_number(value: str) -> bool:
    return bool(re.fullmatch(r"\(\d{3}\) \d{5} \d{4}", value))


def _valid_password(value: str) -> bool:
    if len(value) < 8 or len(value) > 72:
        return False
    has_upper = bool(re.search(r"[A-Z]", value))
    has_number = bool(re.search(r"\d", value))
    has_special = bool(re.search(r"[^A-Za-z0-9]", value))
    return has_upper and has_number and has_special


def _valid_username(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9]{3,80}", value))


def _valid_name(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z ]{2,120}", value))

def _log_activity(db: Session, event: str, extras: dict, user_id: int | None = None) -> None:
    payload = {"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), **extras}
    db.add(ActivityLog(user_id=user_id, extras=payload))


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.get("/docs", include_in_schema=False)
def custom_docs() -> HTMLResponse:
    docs_path = Path(__file__).parent / "static" / "docs.html"
    return HTMLResponse(docs_path.read_text(encoding="utf-8"))


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    icon_path = Path(__file__).parent / "static" / "favicon.svg"
    return FileResponse(icon_path, media_type="image/svg+xml")


@app.get("/swagger", include_in_schema=False)
def swagger_ui():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title="rentED API Swagger",
        swagger_css_url="/static/docs.css",
        swagger_ui_parameters={"docExpansion": "list"},
    )


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    session_id = new_session_id()
    session = UserSession(
        id=session_id,
        user_id=user.id,
        created_at=datetime.now(timezone.utc),
        expires_at=session_expiry(),
    )
    db.add(session)
    db.commit()

    response.set_cookie(
        key=cookie_name(),
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        max_age=int((session.expires_at - session.created_at).total_seconds()),
    )
    return LoginResponse(id=user.id, username=user.username, role=user.role, name=user.name)


@app.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    session_id = request.cookies.get(cookie_name())
    if session_id:
        session = db.get(UserSession, session_id)
        if session:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    response.delete_cookie(cookie_name())
    return {"status": "ok"}


@app.get("/auth/me", response_model=AuthMeResponse)
def me(user: User | None = Depends(get_optional_user)) -> AuthMeResponse:
    if user is None:
        return AuthMeResponse(user=None)
    return AuthMeResponse(user=UserOut.model_validate(user))


@app.get("/users", response_model=list[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[UserOut]:
    return db.execute(select(User)).scalars().all()


@app.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> UserOut:
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="invalid_role")
    if not _valid_username(payload.username):
        raise HTTPException(status_code=422, detail="invalid_username")
    if not _valid_password(payload.password):
        raise HTTPException(status_code=422, detail="weak_password")
    if not _valid_name(payload.name):
        raise HTTPException(status_code=422, detail="invalid_name")
    if not _valid_cell_number(payload.cell_number):
        raise HTTPException(status_code=422, detail="invalid_cell_number")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        name=payload.name,
        cell_number=payload.cell_number,
        extras=payload.extras,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="username_exists") from exc
    return user


@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="not_found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="admin_protected")
    db.execute(delete(UserSession).where(UserSession.user_id == user_id))
    db.delete(user)
    db.commit()
    return Response(status_code=204)


@app.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="not_found")
    if payload.role is not None and payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="invalid_role")
    if payload.username is not None and not _valid_username(payload.username):
        raise HTTPException(status_code=422, detail="invalid_username")
    if payload.password is not None and not _valid_password(payload.password):
        raise HTTPException(status_code=422, detail="weak_password")
    if payload.name is not None and not _valid_name(payload.name):
        raise HTTPException(status_code=422, detail="invalid_name")
    if payload.cell_number is not None and not _valid_cell_number(payload.cell_number):
        raise HTTPException(status_code=422, detail="invalid_cell_number")

    if payload.username is not None:
        user.username = payload.username
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.name is not None:
        user.name = payload.name
    if payload.cell_number is not None:
        user.cell_number = payload.cell_number
    if payload.extras is not None:
        user.extras = payload.extras
    try:
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="username_exists") from exc
    return user


@app.get("/properties", response_model=list[PropertyOut])
def list_properties(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PropertyOut]:
    return db.execute(select(Property)).scalars().all()


@app.post("/properties", response_model=PropertyOut, status_code=201)
def create_property(
    payload: PropertyCreate, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PropertyOut:
    prop = Property(owner_user_id=payload.owner_user_id, extras=payload.extras)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@app.put("/properties/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int,
    payload: PropertyUpdate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PropertyOut:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    if payload.owner_user_id is not None:
        prop.owner_user_id = payload.owner_user_id
    if payload.extras is not None:
        prop.extras = payload.extras
    db.commit()
    db.refresh(prop)
    return prop


@app.delete("/properties/{property_id}", status_code=204)
def delete_property(
    property_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    doc_ids = (
        db.execute(select(Document.id).where(Document.property_id == property_id))
        .scalars()
        .all()
    )
    if doc_ids:
        db.execute(
            delete(DocumentExtraction).where(DocumentExtraction.document_id.in_(doc_ids))
        )
        db.execute(delete(Document).where(Document.id.in_(doc_ids)))
    db.execute(delete(WorkOrder).where(WorkOrder.property_id == property_id))
    db.delete(prop)
    db.commit()
    return Response(status_code=204)


@app.post("/documents/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    property_id: int,
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentOut:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="property_not_found")

    upload_dir = get_upload_dir()
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.split(".")[-1]
    file_id = f"{uuid.uuid4().hex}{suffix}"
    file_path = upload_dir / file_id
    with file_path.open("wb") as handle:
        handle.write(file.file.read())

    doc = Document(
        property_id=property_id,
        extras={"path": str(file_path), "status": "uploaded", "name": file.filename},
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    _log_activity(
        db,
        "document_uploaded",
        {"document_id": doc.id, "property_id": property_id},
    )
    db.commit()

    try:
        if is_inline_mode():
            process_document_job(doc.id)
        else:
            try_enqueue(process_document_job, doc.id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="queue_unavailable") from exc

    return doc


@app.get("/documents", response_model=list[DocumentOut])
def list_documents(
    status: str | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    stmt = select(Document)
    if status:
        stmt = stmt.where(Document.extras["status"].astext == status)
    return db.execute(stmt).scalars().all()


@app.get("/documents/{document_id}/extraction", response_model=DocumentExtractionOut)
def get_document_extraction(
    document_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DocumentExtractionOut:
    extraction = db.execute(
        select(DocumentExtraction).where(DocumentExtraction.document_id == document_id)
    ).scalar_one_or_none()
    if extraction is None:
        raise HTTPException(status_code=404, detail="not_found")
    return extraction


@app.put("/documents/{document_id}/review", response_model=DocumentOut)
def review_document(
    document_id: int,
    payload: DocumentReviewRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="not_found")
    extraction = db.execute(
        select(DocumentExtraction).where(DocumentExtraction.document_id == document_id)
    ).scalar_one_or_none()
    if extraction is None:
        raise HTTPException(status_code=404, detail="extraction_not_found")
    extraction.extras = payload.extraction
    extras = dict(doc.extras or {})
    extras["status"] = "confirmed"
    doc.extras = extras
    _log_activity(
        db,
        "document_review_confirmed",
        {"document_id": document_id, "status": "confirmed"},
    )
    db.commit()
    db.refresh(doc)
    return doc


@app.post("/documents/{document_id}/process", response_model=DocumentProcessResponse)
def process_document(
    document_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DocumentProcessResponse:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="not_found")
    extras = dict(doc.extras or {})
    extras["status"] = "queued"
    doc.extras = extras
    db.commit()
    try:
        if is_inline_mode():
            process_document_job(doc.id)
            db.refresh(doc)
        else:
            try_enqueue(process_document_job, doc.id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="queue_unavailable") from exc
    _log_activity(
        db,
        "document_process_requested",
        {"document_id": document_id, "status": doc.extras.get("status", "")},
    )
    db.commit()
    return DocumentProcessResponse(id=doc.id, status=doc.extras.get("status", ""))


@app.post("/work-orders", response_model=WorkOrderOut, status_code=201)
def create_work_order(
    payload: WorkOrderCreate, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> WorkOrderOut:
    prop = db.get(Property, payload.property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="property_not_found")
    work_order = WorkOrder(property_id=payload.property_id, extras=payload.extras)
    db.add(work_order)
    db.commit()
    db.refresh(work_order)
    return work_order


@app.get("/work-orders", response_model=list[WorkOrderOut])
def list_work_orders(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WorkOrderOut]:
    return db.execute(select(WorkOrder)).scalars().all()
