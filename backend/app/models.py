from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import text

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    name = Column(String(120), nullable=False)
    cell_number = Column(String(20), nullable=False)
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether properties must belong to a user.
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # TODO: define core property fields (e.g., address) beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether documents must belong to a property.
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    # TODO: define core document fields (e.g., type/storage) beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether extractions must belong to a document.
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    # TODO: define core extraction fields beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether work orders must belong to a property.
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    # TODO: define core work order fields beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether expenses must belong to a work order.
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    # TODO: define core expense fields beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether activity entries must belong to a user.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # TODO: define core activity fields beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
