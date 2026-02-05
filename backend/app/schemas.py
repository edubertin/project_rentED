from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, ConfigDict


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=72)


class LoginResponse(BaseModel):
    id: int
    username: str
    role: str
    name: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=72)
    role: str = Field(min_length=1)
    name: str = Field(min_length=2, max_length=120)
    cell_number: str = Field(min_length=8, max_length=20)
    email: str = Field(min_length=3, max_length=160)
    cpf: str = Field(min_length=8, max_length=20)
    extras: Dict[str, Any] = Field(default_factory=dict)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    name: str
    cell_number: str
    email: str | None = None
    cpf: str | None = None
    extras: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


class AuthMeResponse(BaseModel):
    user: UserOut | None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=80)
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)
    role: Optional[str] = Field(default=None, min_length=1)
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    cell_number: Optional[str] = Field(default=None, min_length=8, max_length=20)
    email: Optional[str] = Field(default=None, min_length=3, max_length=160)
    cpf: Optional[str] = Field(default=None, min_length=8, max_length=20)
    extras: Optional[Dict[str, Any]] = None


class PropertyImportResponse(BaseModel):
    doc_type: str
    fields: Dict[str, Any]
    summary: str
    alerts: list[str]
    confidence: float


class ContractModelOut(BaseModel):
    id: int
    key: str
    display_name: str
    model_type: str
    version: int
    is_active: bool
    real_estate_user_id: int | None = None
    base_fields: list[str]
    custom_fields: list[dict]
    detection_keywords: list[str]
    model_prompt: str | None = None
    model_config = ConfigDict(from_attributes=True)


class ContractModelCreate(BaseModel):
    key: str = Field(min_length=3, max_length=120)
    display_name: str = Field(min_length=3, max_length=180)
    model_type: str = Field(min_length=3, max_length=40)
    version: int | None = None
    is_active: bool = True
    real_estate_user_id: int | None = None
    base_fields: list[str] = Field(default_factory=list)
    custom_fields: list[dict] = Field(default_factory=list)
    detection_keywords: list[str] = Field(default_factory=list)
    model_prompt: str | None = None


class ContractModelUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=180)
    model_type: str | None = Field(default=None, min_length=3, max_length=40)
    is_active: bool | None = None
    real_estate_user_id: int | None = None
    base_fields: list[str] | None = None
    custom_fields: list[dict] | None = None
    detection_keywords: list[str] | None = None
    model_prompt: str | None = None


class PropertyCreate(BaseModel):
    owner_user_id: int
    extras: Dict[str, Any] = Field(default_factory=dict)


class PropertyUpdate(BaseModel):
    owner_user_id: Optional[int] = None
    extras: Optional[Dict[str, Any]] = None


class PropertyOut(BaseModel):
    id: int
    owner_user_id: int
    extras: Dict[str, Any]


class DocumentOut(BaseModel):
    id: int
    property_id: int
    extras: Dict[str, Any]


class DocumentExtractionOut(BaseModel):
    id: int
    document_id: int
    extras: Dict[str, Any]


class DocumentReviewRequest(BaseModel):
    extraction: Dict[str, Any]


class WorkOrderCreate(BaseModel):
    property_id: int
    type: str = Field(min_length=3, max_length=20)
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=3, max_length=2000)
    offer_amount: float | None = None


class WorkOrderOut(BaseModel):
    id: int
    property_id: int
    type: str
    status: str
    title: str
    description: str
    offer_amount: float | None = None
    approved_amount: float | None = None
    assigned_interest_id: int | None = None
    created_by_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    extras: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


class WorkOrderCreateResponse(BaseModel):
    work_order: WorkOrderOut
    portal_links: Dict[str, str]


class WorkOrderQuoteCreate(BaseModel):
    provider_name: str = Field(min_length=2, max_length=160)
    provider_phone: str = Field(min_length=6, max_length=40)
    lines: list[dict] = Field(default_factory=list)
    total_amount: float


class WorkOrderInterestCreate(BaseModel):
    provider_name: str = Field(min_length=2, max_length=160)
    provider_phone: str = Field(min_length=6, max_length=40)
    note: str | None = None


class WorkOrderProofCreate(BaseModel):
    provider_name: str = Field(min_length=2, max_length=160)
    provider_phone: str = Field(min_length=6, max_length=40)
    pix_key_type: str = Field(min_length=3, max_length=20)
    pix_key_value: str = Field(min_length=3, max_length=120)
    pix_receiver_name: str = Field(min_length=2, max_length=160)


class WorkOrderApproveQuote(BaseModel):
    approved_amount: float


class WorkOrderPortalView(BaseModel):
    work_order: Dict[str, Any]
    allowed_action: str
    quote: Dict[str, Any] | None = None
    interest: Dict[str, Any] | None = None


class ActivityLogOut(BaseModel):
    id: int
    user_id: int | None
    extras: Dict[str, Any]


class DocumentProcessResponse(BaseModel):
    id: int
    status: str
