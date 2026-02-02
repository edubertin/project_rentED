from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    role: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
    extras: Dict[str, Any] = Field(default_factory=dict)


class WorkOrderOut(BaseModel):
    id: int
    property_id: int
    extras: Dict[str, Any]


class DocumentProcessResponse(BaseModel):
    id: int
    status: str
