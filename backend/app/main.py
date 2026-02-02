import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import create_token
from app.deps import get_db
from app.models import ActivityLog, Document, DocumentExtraction, Property, User, WorkOrder
from app.queue import is_inline_mode, try_enqueue
from app.schemas import (
    DocumentOut,
    DocumentProcessResponse,
    DocumentExtractionOut,
    DocumentReviewRequest,
    LoginRequest,
    LoginResponse,
    PropertyCreate,
    PropertyOut,
    PropertyUpdate,
    UserCreate,
    UserOut,
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


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
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    # TODO: add proper credential fields/verification once defined.
    user = db.execute(select(User).where(User.role == payload.role)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    token = create_token(user.id, user.role)
    return LoginResponse(access_token=token)


@app.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    return db.execute(select(User)).scalars().all()


@app.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    user = User(role=payload.role, extras=payload.extras)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/properties", response_model=list[PropertyOut])
def list_properties(db: Session = Depends(get_db)) -> list[PropertyOut]:
    return db.execute(select(Property)).scalars().all()


@app.post("/properties", response_model=PropertyOut, status_code=201)
def create_property(payload: PropertyCreate, db: Session = Depends(get_db)) -> PropertyOut:
    prop = Property(owner_user_id=payload.owner_user_id, extras=payload.extras)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@app.put("/properties/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int, payload: PropertyUpdate, db: Session = Depends(get_db)
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
def delete_property(property_id: int, db: Session = Depends(get_db)) -> JSONResponse:
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
def list_documents(status: str | None = None, db: Session = Depends(get_db)) -> list[DocumentOut]:
    stmt = select(Document)
    if status:
        stmt = stmt.where(Document.extras["status"].astext == status)
    return db.execute(stmt).scalars().all()


@app.get("/documents/{document_id}/extraction", response_model=DocumentExtractionOut)
def get_document_extraction(document_id: int, db: Session = Depends(get_db)) -> DocumentExtractionOut:
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
def process_document(document_id: int, db: Session = Depends(get_db)) -> DocumentProcessResponse:
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
def create_work_order(payload: WorkOrderCreate, db: Session = Depends(get_db)) -> WorkOrderOut:
    prop = db.get(Property, payload.property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="property_not_found")
    work_order = WorkOrder(property_id=payload.property_id, extras=payload.extras)
    db.add(work_order)
    db.commit()
    db.refresh(work_order)
    return work_order


@app.get("/work-orders", response_model=list[WorkOrderOut])
def list_work_orders(db: Session = Depends(get_db)) -> list[WorkOrderOut]:
    return db.execute(select(WorkOrder)).scalars().all()
