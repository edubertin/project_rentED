import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import create_token
from app.deps import get_db
from app.models import Document, DocumentExtraction, Property, User, WorkOrder
from app.schemas import (
    DocumentOut,
    DocumentProcessResponse,
    LoginRequest,
    LoginResponse,
    PropertyCreate,
    PropertyOut,
    PropertyUpdate,
    WorkOrderCreate,
    WorkOrderOut,
)
from app.storage import get_upload_dir

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


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.get("/docs", include_in_schema=False)
def custom_docs() -> HTMLResponse:
    docs_path = Path(__file__).parent / "static" / "docs.html"
    return HTMLResponse(docs_path.read_text(encoding="utf-8"))


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
    return JSONResponse(status_code=204, content=None)


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
    return doc


@app.get("/documents", response_model=list[DocumentOut])
def list_documents(status: str | None = None, db: Session = Depends(get_db)) -> list[DocumentOut]:
    stmt = select(Document)
    if status:
        stmt = stmt.where(Document.extras["status"].astext == status)
    return db.execute(stmt).scalars().all()


@app.post("/documents/{document_id}/process", response_model=DocumentProcessResponse)
def process_document(document_id: int, db: Session = Depends(get_db)) -> DocumentProcessResponse:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="not_found")
    extras = dict(doc.extras or {})
    extras["status"] = "processed"
    doc.extras = extras
    extraction = DocumentExtraction(document_id=document_id, extras={"status": "mocked"})
    db.add(extraction)
    db.commit()
    db.refresh(doc)
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
