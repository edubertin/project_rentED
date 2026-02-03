from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


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
    extras: Dict[str, Any] = Field(default_factory=dict)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    name: str
    cell_number: str
    extras: Dict[str, Any]

    class Config:
        from_attributes = True


class AuthMeResponse(BaseModel):
    user: UserOut | None


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
