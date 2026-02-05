import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import re
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, or_, select
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
from app.models import (
    ActivityLog,
    Document,
    DocumentExtraction,
    Property,
    PropertyContract,
    Session as UserSession,
    User,
    WorkOrder,
    WorkOrderInterest,
    WorkOrderProof,
    WorkOrderQuote,
    WorkOrderToken,
)
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
    PropertyImportResponse,
    WorkOrderCreate,
    WorkOrderOut,
    WorkOrderCreateResponse,
    WorkOrderQuoteCreate,
    WorkOrderInterestCreate,
    WorkOrderApproveQuote,
    WorkOrderPortalView,
    ActivityLogOut,
)
from app.storage import get_upload_dir
from app.worker import process_document_job
from app.ai import (
    extract_text,
    prepare_llm_input,
    run_llm_extraction,
    summarize_property,
    quick_extract_contract_fields,
)

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

PORTAL_TOKEN_SECRET = os.environ.get("PORTAL_TOKEN_SECRET", "dev-secret")
PORTAL_TOKEN_TTL_HOURS = int(os.environ.get("PORTAL_TOKEN_TTL_HOURS", "336"))


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


def _valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))


def _valid_cpf(value: str) -> bool:
    digits = re.sub(r"\D", "", value or "")
    return len(digits) == 11


def _sanitize_filename(filename: str) -> str:
    return Path(filename).name


def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return value
    if digits.startswith("55") and len(digits) in {12, 13}:
        return f"+{digits}"
    if len(digits) in {10, 11}:
        return f"+55{digits}"
    return f"+{digits}" if digits.startswith("00") else digits


def _hash_portal_token(token: str) -> str:
    payload = f"{PORTAL_TOKEN_SECRET}:{token}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _new_portal_token() -> str:
    return secrets.token_urlsafe(32)


def _portal_token_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=PORTAL_TOKEN_TTL_HOURS)


def _latest_proof(db: Session, work_order_id: int) -> WorkOrderProof | None:
    return (
        db.execute(
            select(WorkOrderProof)
            .where(WorkOrderProof.work_order_id == work_order_id)
            .order_by(WorkOrderProof.id.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )


def _delete_work_order(db: Session, work_order_id: int) -> None:
    db.execute(delete(WorkOrderToken).where(WorkOrderToken.work_order_id == work_order_id))
    db.execute(delete(WorkOrderProof).where(WorkOrderProof.work_order_id == work_order_id))
    db.execute(delete(WorkOrderQuote).where(WorkOrderQuote.work_order_id == work_order_id))
    db.execute(delete(WorkOrderInterest).where(WorkOrderInterest.work_order_id == work_order_id))
    db.execute(delete(WorkOrder).where(WorkOrder.id == work_order_id))


def _get_portal_token(db: Session, token: str) -> WorkOrderToken:
    token_hash = _hash_portal_token(token)
    row = db.execute(
        select(WorkOrderToken).where(WorkOrderToken.token_hash == token_hash)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="invalid_token")
    if not row.is_active:
        raise HTTPException(status_code=403, detail="token_inactive")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="token_expired")
    return row


def _work_order_summary(work_order: WorkOrder, prop: Property | None) -> dict:
    extras = dict(work_order.extras or {})
    if prop:
        extras["property_tag"] = prop.extras.get("tag") or prop.extras.get("label")
        extras["property_address"] = prop.extras.get("property_address")
    return {
        "id": work_order.id,
        "property_id": work_order.property_id,
        "type": work_order.type,
        "status": work_order.status,
        "title": work_order.title,
        "description": work_order.description,
        "offer_amount": float(work_order.offer_amount) if work_order.offer_amount is not None else None,
        "approved_amount": float(work_order.approved_amount) if work_order.approved_amount is not None else None,
        "assigned_interest_id": work_order.assigned_interest_id,
        "created_by_user_id": work_order.created_by_user_id,
        "created_at": work_order.created_at.isoformat() if work_order.created_at else None,
        "updated_at": work_order.updated_at.isoformat() if work_order.updated_at else None,
        "extras": extras,
    }


def _portal_allowed_action(token_row: WorkOrderToken, work_order: WorkOrder) -> str:
    if work_order.status in {"closed", "canceled"}:
        return "read_only"
    if token_row.scope == "quote_portal":
        if work_order.type != "quote":
            return "read_only"
        if work_order.status in {"quote_requested", "quote_submitted"}:
            return "submit_quote"
        if work_order.status in {"approved_for_execution", "in_progress", "rework_requested"}:
            return "submit_proof"
    if token_row.scope == "fixed_interest":
        if work_order.type == "fixed" and work_order.status == "offer_open":
            return "submit_interest"
    if token_row.scope == "execution":
        if work_order.type == "fixed" and work_order.status in {
            "assigned",
            "in_progress",
            "rework_requested",
        }:
            return "submit_proof"
    return "read_only"


def _upload_photo(file: UploadFile) -> dict:
    upload_dir = get_upload_dir()
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.split(".")[-1]
    file_id = f"{uuid.uuid4().hex}{suffix}"
    file_path = upload_dir / file_id
    with file_path.open("wb") as handle:
        handle.write(file.file.read())
    return {
        "name": file.filename,
        "path": str(file_path),
        "url": f"/uploads/{file_id}",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }


def _should_store_contract(extras: dict) -> bool:
    if extras.get("contract_fields"):
        return True
    keys = [
        "contract_model_key",
        "contract_number",
        "document_code",
        "tenant_name",
        "landlord_name",
        "guarantor_name",
        "administrator_name",
        "guarantee_provider_name",
        "property_address",
    ]
    return any(extras.get(key) for key in keys)


def _to_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value))
    except (ValueError, TypeError):
        return None


def _validate_property_extras(extras: dict) -> None:
    tag = (extras.get("tag") or "").strip()
    if not tag:
        raise HTTPException(status_code=422, detail="missing_tag")
    address = (extras.get("property_address") or "").strip()
    if not address:
        raise HTTPException(status_code=422, detail="missing_property_address")
    bedrooms = _to_int(extras.get("bedrooms"))
    bathrooms = _to_int(extras.get("bathrooms"))
    parking_spaces = _to_int(extras.get("parking_spaces"))
    if bedrooms is None or bedrooms < 0:
        raise HTTPException(status_code=422, detail="invalid_bedrooms")
    if bathrooms is None or bathrooms < 0:
        raise HTTPException(status_code=422, detail="invalid_bathrooms")
    if parking_spaces is None or parking_spaces < 0:
        raise HTTPException(status_code=422, detail="invalid_parking_spaces")
    is_rented = bool(extras.get("is_rented"))
    desired_rent = _to_int(extras.get("desired_rent_value"))
    current_rent = _to_int(extras.get("current_rent_value"))
    legacy_rent = _to_int(extras.get("rent_amount_value"))
    if is_rented:
        if not (current_rent and current_rent > 0) and not (legacy_rent and legacy_rent > 0):
            raise HTTPException(status_code=422, detail="missing_current_rent")
    else:
        if not (desired_rent and desired_rent > 0):
            raise HTTPException(status_code=422, detail="missing_desired_rent")


def _sync_property_contract(db: Session, prop: Property, extras: dict) -> None:
    if not extras or not _should_store_contract(extras):
        return
    contract = db.execute(
        select(PropertyContract).where(PropertyContract.property_id == prop.id)
    ).scalar_one_or_none()
    if contract is None:
        contract = PropertyContract(property_id=prop.id)
        db.add(contract)
    contract.model_key = extras.get("contract_model_key")
    contract.model_label = extras.get("contract_model_label")
    contract.real_estate_user_id = _to_int(extras.get("contract_real_estate_id"))
    contract.contract_model_id = _to_int(extras.get("contract_model_id"))
    contract.document_id = _to_int(extras.get("contract_document_id"))
    contract.real_estate_name = extras.get("real_estate_name")
    contract.contract_title = extras.get("contract_title")
    contract.document_platform = extras.get("document_platform")
    contract.document_code = extras.get("document_code")
    contract.contract_number = extras.get("contract_number")
    contract.landlord_name = extras.get("landlord_name")
    contract.landlord_cpf = extras.get("landlord_cpf")
    contract.landlord_rg = extras.get("landlord_rg")
    contract.landlord_address = extras.get("landlord_address")
    contract.tenant_name = extras.get("tenant_name")
    contract.tenant_cpf = extras.get("tenant_cpf")
    contract.tenant_rg = extras.get("tenant_rg")
    contract.tenant_address = extras.get("tenant_address")
    contract.guarantor_name = extras.get("guarantor_name")
    contract.guarantor_cpf = extras.get("guarantor_cpf")
    contract.guarantor_rg = extras.get("guarantor_rg")
    contract.administrator_name = extras.get("administrator_name")
    contract.administrator_creci = extras.get("administrator_creci")
    contract.administrator_address = extras.get("administrator_address")
    contract.admin_fee_percent = extras.get("admin_fee_percent")
    contract.guarantee_provider_name = extras.get("guarantee_provider_name")
    contract.guarantee_provider_cnpj = extras.get("guarantee_provider_cnpj")
    contract.guarantee_provider_address = extras.get("guarantee_provider_address")
    contract.guarantee_annex_reference = extras.get("guarantee_annex_reference")
    contract.payment_method = extras.get("payment_method")
    contract.includes_condominium = bool(extras.get("includes_condominium"))
    contract.includes_iptu = bool(extras.get("includes_iptu"))
    contract.late_fee_percent = extras.get("late_fee_percent")
    contract.interest_percent_month = extras.get("interest_percent_month")
    contract.tolerance_rule = extras.get("tolerance_rule")
    contract.breach_penalty_months = extras.get("breach_penalty_months")
    rent_cents = _to_int(extras.get("current_rent_value"))
    if rent_cents is None:
        rent_cents = _to_int(extras.get("rent_amount_value"))
    contract.rent_amount_cents = rent_cents
    contract.rent_currency = extras.get("rent_currency")
    contract.payment_day = _to_int(extras.get("payment_day"))
    contract.indexation_type = extras.get("indexation_type")
    contract.indexation_rate = extras.get("indexation_rate")
    contract.start_date = extras.get("start_date")
    contract.end_date = extras.get("end_date")
    contract.term_months = _to_int(extras.get("term_months"))
    contract.sign_date = extras.get("sign_date")
    contract.forum_city = extras.get("forum_city")
    contract.forum_state = extras.get("forum_state")
    contract.signed_city = extras.get("signed_city")
    contract.signed_state = extras.get("signed_state")
    contract.document_numbers = extras.get("document_numbers")
    contract.witnesses = extras.get("witnesses")
    contract.notes = extras.get("notes")
    contract.sensitive_topics = extras.get("sensitive_topics")
    contract.contract_fields = extras.get("contract_fields") or extras


def _log_activity(
    db: Session,
    event: str,
    extras: dict,
    user_id: int | None = None,
    actor_type: str = "admin",
    token_id: int | None = None,
) -> None:
    payload = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor_type": actor_type,
        **extras,
    }
    if token_id is not None:
        payload["token_id"] = token_id
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


@app.get("/uploads/{filename}", include_in_schema=False)
def serve_upload(filename: str) -> FileResponse:
    safe_name = _sanitize_filename(filename)
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="invalid_filename")
    file_path = get_upload_dir() / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="not_found")
    return FileResponse(file_path)


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

    _log_activity(
        db,
        "user_login",
        {"user_id": user.id, "username": user.username, "role": user.role},
        user_id=user.id,
    )
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


@app.get("/real-estates", response_model=list[UserOut])
def list_real_estates(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[UserOut]:
    return (
        db.execute(select(User).where(User.role == "real_estate"))
        .scalars()
        .all()
    )



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
    if not _valid_email(payload.email):
        raise HTTPException(status_code=422, detail="invalid_email")
    if not _valid_cpf(payload.cpf):
        raise HTTPException(status_code=422, detail="invalid_cpf")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        name=payload.name,
        cell_number=payload.cell_number,
        email=payload.email,
        cpf=payload.cpf,
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
    if payload.email is not None and not _valid_email(payload.email):
        raise HTTPException(status_code=422, detail="invalid_email")
    if payload.cpf is not None and not _valid_cpf(payload.cpf):
        raise HTTPException(status_code=422, detail="invalid_cpf")

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
    if payload.email is not None:
        user.email = payload.email
    if payload.cpf is not None:
        user.cpf = payload.cpf
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
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PropertyOut]:
    stmt = select(Property)
    if user.role != "admin":
        stmt = stmt.where(Property.owner_user_id == user.id)
    return db.execute(stmt).scalars().all()


@app.get("/properties/{property_id}/summary")
def property_summary(
    property_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    if user.role != "admin" and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    extras = dict(prop.extras or {})
    summary = summarize_property(extras)
    return {"summary": summary}


@app.post("/properties", response_model=PropertyOut, status_code=201)
def create_property(
    payload: PropertyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PropertyOut:
    if user.role not in {"admin", "property_owner"}:
        raise HTTPException(status_code=403, detail="forbidden_role")
    owner_user_id = payload.owner_user_id
    if user.role != "admin":
        if owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="forbidden_owner")
        owner_user_id = user.id
    owner_user = db.get(User, owner_user_id)
    if owner_user is None:
        raise HTTPException(status_code=422, detail="invalid_owner")
    extras = dict(payload.extras or {})
    _validate_property_extras(extras)
    if user.role == "admin":
        email = extras.get("owner_email")
        cpf = extras.get("owner_cpf")
        cell = extras.get("owner_cell_number")
        if email:
            if not _valid_email(email):
                raise HTTPException(status_code=422, detail="invalid_owner_email")
            owner_user.email = email
        if cpf:
            if not _valid_cpf(cpf):
                raise HTTPException(status_code=422, detail="invalid_owner_cpf")
            owner_user.cpf = cpf
        if cell:
            if not _valid_cell_number(cell):
                raise HTTPException(status_code=422, detail="invalid_owner_cell")
            owner_user.cell_number = cell
    extras["owner_contact"] = {
        "name": owner_user.name,
        "email": owner_user.email,
        "cpf": owner_user.cpf,
        "cell_number": owner_user.cell_number,
    }
    # TODO: enforce at least one photo exists before property is considered active.
    prop = Property(owner_user_id=owner_user_id, extras=extras)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    _sync_property_contract(db, prop, extras)
    _log_activity(
        db,
        "property_created",
        {"property_id": prop.id, "owner_user_id": owner_user_id},
        user_id=user.id,
    )
    db.commit()
    return prop


@app.put("/properties/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int,
    payload: PropertyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PropertyOut:
    if user.role not in {"admin", "property_owner"}:
        raise HTTPException(status_code=403, detail="forbidden_role")
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    if user.role != "admin" and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    if payload.owner_user_id is not None:
        if user.role != "admin" and payload.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="forbidden_owner")
        prop.owner_user_id = payload.owner_user_id
    if payload.extras is not None:
        extras = dict(payload.extras or {})
        _validate_property_extras(extras)
        owner_user = db.get(User, prop.owner_user_id)
        if owner_user and user.role == "admin":
            email = extras.get("owner_email")
            cpf = extras.get("owner_cpf")
            cell = extras.get("owner_cell_number")
            if email:
                if not _valid_email(email):
                    raise HTTPException(status_code=422, detail="invalid_owner_email")
                owner_user.email = email
            if cpf:
                if not _valid_cpf(cpf):
                    raise HTTPException(status_code=422, detail="invalid_owner_cpf")
                owner_user.cpf = cpf
            if cell:
                if not _valid_cell_number(cell):
                    raise HTTPException(status_code=422, detail="invalid_owner_cell")
                owner_user.cell_number = cell
        if owner_user:
            extras["owner_contact"] = {
                "name": owner_user.name,
                "email": owner_user.email,
                "cpf": owner_user.cpf,
                "cell_number": owner_user.cell_number,
            }
        prop.extras = extras
        _sync_property_contract(db, prop, extras)
    else:
        _sync_property_contract(db, prop, prop.extras or {})
    db.commit()
    db.refresh(prop)
    _log_activity(
        db,
        "property_updated",
        {"property_id": prop.id, "owner_user_id": prop.owner_user_id},
        user_id=user.id,
    )
    db.commit()
    return prop


@app.delete("/properties/{property_id}", status_code=204)
def delete_property(
    property_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    if user.role not in {"admin", "property_owner"}:
        raise HTTPException(status_code=403, detail="forbidden_role")
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    if user.role != "admin" and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    photo_items = (prop.extras or {}).get("photos", [])
    for item in photo_items:
        path = item.get("path")
        if path and Path(path).exists():
            try:
                Path(path).unlink()
            except OSError:
                pass
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
    db.execute(delete(PropertyContract).where(PropertyContract.property_id == property_id))
    work_order_ids = (
        db.execute(select(WorkOrder.id).where(WorkOrder.property_id == property_id))
        .scalars()
        .all()
    )
    if work_order_ids:
        db.execute(delete(WorkOrderToken).where(WorkOrderToken.work_order_id.in_(work_order_ids)))
        db.execute(delete(WorkOrderProof).where(WorkOrderProof.work_order_id.in_(work_order_ids)))
        db.execute(delete(WorkOrderQuote).where(WorkOrderQuote.work_order_id.in_(work_order_ids)))
        db.execute(delete(WorkOrderInterest).where(WorkOrderInterest.work_order_id.in_(work_order_ids)))
        db.execute(delete(WorkOrder).where(WorkOrder.id.in_(work_order_ids)))
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
    except Exception:
        _log_activity(
            db,
            "document_process_failed",
            {"document_id": doc.id, "status": "uploaded"},
        )
        db.commit()

    return doc


@app.post("/properties/import", response_model=PropertyImportResponse)
def import_property(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PropertyImportResponse:
    upload_dir = get_upload_dir()
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.split(".")[-1]
    file_id = f"import_{uuid.uuid4().hex}{suffix}"
    file_path = upload_dir / file_id
    with file_path.open("wb") as handle:
        handle.write(file.file.read())
    try:
        extraction = extract_text(str(file_path))
        prepared_text, meta = prepare_llm_input(extraction.text)
        result = run_llm_extraction(
            prepared_text,
            file.filename or "",
            model_fields=None,
            model_prompt=None,
        )
        quick_fields = quick_extract_contract_fields(extraction.text or "")
        fields = result.fields or {}
        for key, value in quick_fields.items():
            if not fields.get(key) and value:
                fields[key] = value
        payload = {
            "doc_type": result.doc_type,
            "fields": fields,
            "summary": result.summary or "",
            "alerts": result.alerts or [],
            "confidence": result.confidence or 0.0,
        }
        _log_activity(
            db,
            "property_import_preview",
            {
                "file_name": file.filename,
                "llm_meta": meta,
            },
            user_id=user.id,
        )
        db.commit()
        return PropertyImportResponse(**payload)
    finally:
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass


@app.post("/properties/{property_id}/photos", response_model=PropertyOut)
def upload_property_photos(
    property_id: int,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PropertyOut:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="not_found")
    if user.role != "admin" and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    if not files:
        raise HTTPException(status_code=422, detail="photos_required")

    extras = dict(prop.extras or {})
    photos = list(extras.get("photos", []))
    if len(photos) + len(files) > 10:
        raise HTTPException(status_code=422, detail="photo_limit_exceeded")

    for file in files:
        photos.append(_upload_photo(file))

    extras["photos"] = photos
    prop.extras = extras
    db.commit()
    db.refresh(prop)
    return prop


@app.get("/documents", response_model=list[DocumentOut])
def list_documents(
    property_id: int | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    stmt = select(Document)
    if property_id is not None:
        prop = db.get(Property, property_id)
        if prop is None:
            raise HTTPException(status_code=404, detail="property_not_found")
        if user.role != "admin" and prop.owner_user_id != user.id:
            raise HTTPException(status_code=403, detail="forbidden_owner")
        stmt = stmt.where(Document.property_id == property_id)
    elif user.role != "admin":
        owned_ids = (
            db.execute(select(Property.id).where(Property.owner_user_id == user.id))
            .scalars()
            .all()
        )
        if not owned_ids:
            return []
        stmt = stmt.where(Document.property_id.in_(owned_ids))
    if status:
        stmt = stmt.where(Document.extras["status"].astext == status)
    docs = db.execute(stmt).scalars().all()
    for doc in docs:
        extras = dict(doc.extras or {})
        prop = db.get(Property, doc.property_id) if doc.property_id else None
        if prop:
            owner = db.get(User, prop.owner_user_id)
            extras["owner_name"] = owner.name if owner else None
            extras["property_tag"] = prop.extras.get("tag") or prop.extras.get("label")
        doc.extras = extras
    return docs


@app.get("/activity-log", response_model=list[ActivityLogOut])
def list_activity_log(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActivityLogOut]:
    stmt = select(ActivityLog).order_by(ActivityLog.id.desc()).limit(200)
    if user.role != "admin":
        stmt = stmt.where(ActivityLog.user_id == user.id)
    return db.execute(stmt).scalars().all()


@app.get("/documents/{document_id}/download", include_in_schema=False)
def download_document(
    document_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="not_found")
    prop = db.get(Property, doc.property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="property_not_found")
    if user.role != "admin" and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    file_path = doc.extras.get("path") if doc.extras else None
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="file_missing")
    filename = doc.extras.get("name") if doc.extras else None
    return FileResponse(file_path, filename=filename)


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


@app.post("/work-orders", response_model=WorkOrderCreateResponse, status_code=201)
def create_work_order(
    payload: WorkOrderCreate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> WorkOrderCreateResponse:
    if payload.type not in {"quote", "fixed"}:
        raise HTTPException(status_code=422, detail="invalid_work_order_type")
    if payload.type == "fixed":
        if payload.offer_amount is None or payload.offer_amount <= 0:
            raise HTTPException(status_code=422, detail="missing_offer_amount")

    prop = db.get(Property, payload.property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="property_not_found")
    now = datetime.now(timezone.utc)
    work_order = WorkOrder(
        property_id=payload.property_id,
        type=payload.type,
        status="quote_requested" if payload.type == "quote" else "offer_open",
        title=payload.title,
        description=payload.description,
        offer_amount=payload.offer_amount if payload.type == "fixed" else None,
        approved_amount=None,
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
        extras={},
    )
    db.add(work_order)
    db.commit()
    db.refresh(work_order)

    token_value = _new_portal_token()
    token_hash = _hash_portal_token(token_value)
    token = WorkOrderToken(
        work_order_id=work_order.id,
        token_hash=token_hash,
        scope="quote_portal" if payload.type == "quote" else "fixed_interest",
        expires_at=_portal_token_expires_at(),
        created_at=now,
        is_active=True,
    )
    db.add(token)
    _log_activity(
        db,
        "work_order_created",
        {"work_order_id": work_order.id, "property_id": work_order.property_id},
        user_id=user.id,
    )
    db.commit()
    db.refresh(token)

    portal_links = {"portal": f"/p/wo/{token_value}"}
    return WorkOrderCreateResponse(
        work_order=WorkOrderOut.model_validate(work_order),
        portal_links=portal_links,
    )


@app.get("/work-orders", response_model=list[WorkOrderOut])
def list_work_orders(
    property_id: int | None = None,
    status: str | None = None,
    type: str | None = None,
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkOrderOut]:
    stmt = select(WorkOrder)
    if property_id is not None:
        stmt = stmt.where(WorkOrder.property_id == property_id)
    if status:
        stmt = stmt.where(WorkOrder.status == status)
    if type:
        stmt = stmt.where(WorkOrder.type == type)
    if search:
        stmt = stmt.where(
            or_(
                WorkOrder.title.ilike(f"%{search}%"),
                WorkOrder.description.ilike(f"%{search}%"),
            )
        )
    if user.role != "admin":
        owned_ids = (
            db.execute(select(Property.id).where(Property.owner_user_id == user.id))
            .scalars()
            .all()
        )
        if not owned_ids:
            return []
        stmt = stmt.where(WorkOrder.property_id.in_(owned_ids))

    work_orders = db.execute(stmt.order_by(WorkOrder.id.desc())).scalars().all()
    for item in work_orders:
        prop = db.get(Property, item.property_id)
        extras = dict(item.extras or {})
        if prop:
            extras["property_tag"] = prop.extras.get("tag") or prop.extras.get("label")
            extras["property_address"] = prop.extras.get("property_address")
        item.extras = extras
    return work_orders


@app.get("/work-orders/{work_order_id}")
def get_work_order(
    work_order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    prop = db.get(Property, work_order.property_id)
    if user.role != "admin" and prop and prop.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="forbidden_owner")
    summary = _work_order_summary(work_order, prop)

    quotes = db.execute(
        select(WorkOrderQuote).where(WorkOrderQuote.work_order_id == work_order_id)
    ).scalars().all()
    interests = db.execute(
        select(WorkOrderInterest).where(WorkOrderInterest.work_order_id == work_order_id)
    ).scalars().all()
    proofs = db.execute(
        select(WorkOrderProof).where(WorkOrderProof.work_order_id == work_order_id)
    ).scalars().all()
    tokens = db.execute(
        select(WorkOrderToken).where(WorkOrderToken.work_order_id == work_order_id)
    ).scalars().all()

    def _serialize_row(row) -> dict:
        data = row.__dict__.copy()
        data.pop("_sa_instance_state", None)
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        return data

    return {
        "work_order": summary,
        "quotes": [_serialize_row(q) for q in quotes],
        "interests": [_serialize_row(i) for i in interests],
        "proofs": [_serialize_row(p) for p in proofs],
        "tokens": [
            {
                "id": t.id,
                "scope": t.scope,
                "expires_at": t.expires_at.isoformat(),
                "quote_id": t.quote_id,
                "interest_id": t.interest_id,
                "is_active": t.is_active,
                "used_at": t.used_at.isoformat() if t.used_at else None,
                "created_at": t.created_at.isoformat(),
            }
            for t in tokens
        ],
    }


@app.post("/work-orders/{work_order_id}/approve-quote/{quote_id}")
def approve_work_order_quote(
    work_order_id: int,
    quote_id: int,
    payload: WorkOrderApproveQuote,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    if work_order.type != "quote":
        raise HTTPException(status_code=422, detail="invalid_work_order_type")
    quote = db.get(WorkOrderQuote, quote_id)
    if quote is None or quote.work_order_id != work_order_id:
        raise HTTPException(status_code=404, detail="quote_not_found")

    quote.status = "approved"
    work_order.approved_amount = payload.approved_amount
    work_order.status = "approved_for_execution"
    work_order.updated_at = datetime.now(timezone.utc)
    db.execute(
        WorkOrderQuote.__table__.update()
        .where(WorkOrderQuote.work_order_id == work_order_id, WorkOrderQuote.id != quote_id)
        .values(status="rejected")
    )
    _log_activity(
        db,
        "quote_approved",
        {"work_order_id": work_order_id, "quote_id": quote_id},
    )
    db.commit()
    return {"status": "ok"}


@app.post("/work-orders/{work_order_id}/select-interest/{interest_id}")
def select_work_order_interest(
    work_order_id: int,
    interest_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    if work_order.type != "fixed":
        raise HTTPException(status_code=422, detail="invalid_work_order_type")
    interest = db.get(WorkOrderInterest, interest_id)
    if interest is None or interest.work_order_id != work_order_id:
        raise HTTPException(status_code=404, detail="interest_not_found")

    work_order.assigned_interest_id = interest_id
    work_order.status = "assigned"
    work_order.updated_at = datetime.now(timezone.utc)
    interest.status = "selected"
    db.execute(
        WorkOrderInterest.__table__.update()
        .where(
            WorkOrderInterest.work_order_id == work_order_id,
            WorkOrderInterest.id != interest_id,
        )
        .values(status="rejected")
    )
    db.execute(
        WorkOrderToken.__table__.update()
        .where(
            WorkOrderToken.work_order_id == work_order_id,
            WorkOrderToken.scope == "fixed_interest",
        )
        .values(is_active=False)
    )
    token_value = _new_portal_token()
    token_hash = _hash_portal_token(token_value)
    token = WorkOrderToken(
        work_order_id=work_order_id,
        token_hash=token_hash,
        scope="execution",
        expires_at=_portal_token_expires_at(),
        interest_id=interest_id,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(token)
    _log_activity(
        db,
        "provider_selected",
        {"work_order_id": work_order_id, "interest_id": interest_id},
    )
    db.commit()
    return {"status": "ok", "portal_link": f"/p/wo/{token_value}"}


@app.post("/work-orders/{work_order_id}/request-rework")
def request_work_order_rework(
    work_order_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    proof = _latest_proof(db, work_order_id)
    if proof is None:
        raise HTTPException(status_code=404, detail="proof_not_found")
    proof.status = "rework_requested"
    work_order.status = "rework_requested"
    work_order.updated_at = datetime.now(timezone.utc)
    _log_activity(
        db,
        "work_order_rework_requested",
        {"work_order_id": work_order_id, "proof_id": proof.id},
    )
    db.commit()
    return {"status": "ok"}


@app.post("/work-orders/{work_order_id}/approve-proof")
def approve_work_order_proof(
    work_order_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    proof = _latest_proof(db, work_order_id)
    if proof is None:
        raise HTTPException(status_code=404, detail="proof_not_found")
    proof.status = "approved"
    work_order.status = "closed"
    work_order.updated_at = datetime.now(timezone.utc)
    _log_activity(
        db,
        "proof_approved",
        {"work_order_id": work_order_id, "proof_id": proof.id},
        user_id=user.id,
    )
    _log_activity(
        db,
        "work_order_closed",
        {"work_order_id": work_order_id, "proof_id": proof.id},
        user_id=user.id,
    )
    db.commit()
    return {"status": "ok"}


@app.post("/work-orders/{work_order_id}/cancel")
def cancel_work_order(
    work_order_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    work_order.status = "canceled"
    work_order.updated_at = datetime.now(timezone.utc)
    db.execute(
        WorkOrderToken.__table__.update()
        .where(WorkOrderToken.work_order_id == work_order_id)
        .values(is_active=False)
    )
    _log_activity(
        db,
        "work_order_canceled",
        {"work_order_id": work_order_id},
    )
    db.commit()
    return {"status": "ok"}


@app.delete("/work-orders/{work_order_id}", status_code=204)
def delete_work_order(
    work_order_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    work_order = db.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    _delete_work_order(db, work_order_id)
    _log_activity(
        db,
        "work_order_deleted",
        {"work_order_id": work_order_id, "property_id": work_order.property_id},
        user_id=user.id,
    )
    db.commit()
    return Response(status_code=204)


@app.get("/portal/work-orders/{token}", response_model=WorkOrderPortalView)
def get_portal_work_order(token: str, db: Session = Depends(get_db)) -> WorkOrderPortalView:
    token_row = _get_portal_token(db, token)
    work_order = db.get(WorkOrder, token_row.work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    prop = db.get(Property, work_order.property_id)
    allowed_action = _portal_allowed_action(token_row, work_order)
    view = _work_order_summary(work_order, prop)
    view["property_address_full"] = prop.extras.get("property_address") if prop else None

    quote = None
    if token_row.quote_id:
        q = db.get(WorkOrderQuote, token_row.quote_id)
        if q:
            quote = {
                "id": q.id,
                "provider_name": q.provider_name,
                "provider_phone": q.provider_phone,
                "lines": q.lines,
                "total_amount": float(q.total_amount),
                "status": q.status,
            }
    interest = None
    if token_row.interest_id:
        i = db.get(WorkOrderInterest, token_row.interest_id)
        if i:
            interest = {
                "id": i.id,
                "provider_name": i.provider_name,
                "provider_phone": i.provider_phone,
                "status": i.status,
            }
    return WorkOrderPortalView(
        work_order=view,
        allowed_action=allowed_action,
        quote=quote,
        interest=interest,
    )


@app.post("/portal/work-orders/{token}/quote")
def submit_portal_quote(
    token: str,
    payload: WorkOrderQuoteCreate,
    db: Session = Depends(get_db),
) -> dict:
    token_row = _get_portal_token(db, token)
    work_order = db.get(WorkOrder, token_row.work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    if token_row.scope != "quote_portal" or work_order.type != "quote":
        raise HTTPException(status_code=403, detail="forbidden_scope")
    if work_order.status not in {"quote_requested", "quote_submitted"}:
        raise HTTPException(status_code=422, detail="invalid_status")
    if token_row.quote_id:
        raise HTTPException(status_code=409, detail="quote_already_submitted")
    now = datetime.now(timezone.utc)
    quote = WorkOrderQuote(
        work_order_id=work_order.id,
        provider_name=payload.provider_name,
        provider_phone=_normalize_phone(payload.provider_phone),
        lines=payload.lines,
        total_amount=payload.total_amount,
        status="submitted",
        created_at=now,
        updated_at=now,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    token_row.quote_id = quote.id
    work_order.status = "quote_submitted"
    work_order.updated_at = now
    _log_activity(
        db,
        "quote_submitted",
        {"work_order_id": work_order.id, "quote_id": quote.id},
        actor_type="portal",
        token_id=token_row.id,
    )
    db.commit()
    return {"status": "ok"}


@app.post("/portal/work-orders/{token}/interest")
def submit_portal_interest(
    token: str,
    payload: WorkOrderInterestCreate,
    db: Session = Depends(get_db),
) -> dict:
    token_row = _get_portal_token(db, token)
    work_order = db.get(WorkOrder, token_row.work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    if token_row.scope != "fixed_interest" or work_order.type != "fixed":
        raise HTTPException(status_code=403, detail="forbidden_scope")
    if work_order.status != "offer_open":
        raise HTTPException(status_code=422, detail="invalid_status")
    now = datetime.now(timezone.utc)
    interest = WorkOrderInterest(
        work_order_id=work_order.id,
        provider_name=payload.provider_name,
        provider_phone=_normalize_phone(payload.provider_phone),
        status="submitted",
        created_at=now,
        updated_at=now,
    )
    db.add(interest)
    db.commit()
    db.refresh(interest)
    token_row.interest_id = interest.id
    _log_activity(
        db,
        "interest_submitted",
        {"work_order_id": work_order.id, "interest_id": interest.id},
        actor_type="portal",
        token_id=token_row.id,
    )
    db.commit()
    return {"status": "ok"}


@app.post("/portal/work-orders/{token}/submit-proof")
def submit_portal_proof(
    token: str,
    provider_name: str = Form(...),
    provider_phone: str = Form(...),
    pix_key_type: str = Form(...),
    pix_key_value: str = Form(...),
    pix_receiver_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    token_row = _get_portal_token(db, token)
    work_order = db.get(WorkOrder, token_row.work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail="not_found")
    if work_order.status not in {
        "approved_for_execution",
        "in_progress",
        "rework_requested",
        "assigned",
    }:
        raise HTTPException(status_code=422, detail="invalid_status")
    if work_order.type == "quote" and token_row.scope != "quote_portal":
        raise HTTPException(status_code=403, detail="forbidden_scope")
    if work_order.type == "fixed" and token_row.scope != "execution":
        raise HTTPException(status_code=403, detail="forbidden_scope")

    upload_dir = get_upload_dir()
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.split(".")[-1]
    file_id = f"proof_{uuid.uuid4().hex}{suffix}"
    file_path = upload_dir / file_id
    with file_path.open("wb") as handle:
        handle.write(file.file.read())

    doc = Document(
        property_id=work_order.property_id,
        extras={
            "path": str(file_path),
            "status": "uploaded",
            "name": file.filename,
            "kind": "work_order_proof",
        },
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    now = datetime.now(timezone.utc)
    proof = WorkOrderProof(
        work_order_id=work_order.id,
        provider_name=provider_name,
        provider_phone=_normalize_phone(provider_phone),
        pix_key_type=pix_key_type,
        pix_key_value=pix_key_value,
        pix_receiver_name=pix_receiver_name,
        document_id=doc.id,
        status="submitted",
        created_at=now,
        updated_at=now,
    )
    db.add(proof)
    work_order.status = "proof_submitted"
    work_order.updated_at = now
    _log_activity(
        db,
        "proof_submitted",
        {"work_order_id": work_order.id, "proof_id": proof.id, "document_id": doc.id},
        actor_type="portal",
        token_id=token_row.id,
    )
    db.commit()
    return {"status": "ok"}
