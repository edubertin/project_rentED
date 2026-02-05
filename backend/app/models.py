from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
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
    email = Column(String(160), nullable=True)
    cpf = Column(String(20), nullable=True)
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True)
    # TODO: confirm whether properties must belong to a user.
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # TODO: define core property fields (e.g., address) beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class PropertyContract(Base):
    __tablename__ = "property_contracts"

    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, unique=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    real_estate_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    contract_model_id = Column(Integer, ForeignKey("contract_models.id"), nullable=True)
    model_key = Column(String(100), nullable=True)
    model_label = Column(String(160), nullable=True)
    real_estate_name = Column(String(160), nullable=True)
    contract_title = Column(String(255), nullable=True)
    document_platform = Column(String(80), nullable=True)
    document_code = Column(String(120), nullable=True)
    contract_number = Column(String(120), nullable=True)
    landlord_name = Column(String(160), nullable=True)
    landlord_cpf = Column(String(40), nullable=True)
    landlord_rg = Column(String(40), nullable=True)
    landlord_address = Column(String(255), nullable=True)
    tenant_name = Column(String(160), nullable=True)
    tenant_cpf = Column(String(40), nullable=True)
    tenant_rg = Column(String(40), nullable=True)
    tenant_address = Column(String(255), nullable=True)
    guarantor_name = Column(String(160), nullable=True)
    guarantor_cpf = Column(String(40), nullable=True)
    guarantor_rg = Column(String(40), nullable=True)
    administrator_name = Column(String(160), nullable=True)
    administrator_creci = Column(String(40), nullable=True)
    administrator_address = Column(String(255), nullable=True)
    admin_fee_percent = Column(String(40), nullable=True)
    guarantee_provider_name = Column(String(160), nullable=True)
    guarantee_provider_cnpj = Column(String(40), nullable=True)
    guarantee_provider_address = Column(String(255), nullable=True)
    guarantee_annex_reference = Column(String(120), nullable=True)
    payment_method = Column(String(80), nullable=True)
    includes_condominium = Column(Boolean, nullable=True)
    includes_iptu = Column(Boolean, nullable=True)
    late_fee_percent = Column(String(40), nullable=True)
    interest_percent_month = Column(String(40), nullable=True)
    tolerance_rule = Column(String(160), nullable=True)
    breach_penalty_months = Column(String(40), nullable=True)
    rent_amount_cents = Column(Integer, nullable=True)
    rent_currency = Column(String(3), nullable=True)
    payment_day = Column(Integer, nullable=True)
    indexation_type = Column(String(80), nullable=True)
    indexation_rate = Column(String(80), nullable=True)
    start_date = Column(String(40), nullable=True)
    end_date = Column(String(40), nullable=True)
    term_months = Column(Integer, nullable=True)
    sign_date = Column(String(40), nullable=True)
    forum_city = Column(String(120), nullable=True)
    forum_state = Column(String(40), nullable=True)
    signed_city = Column(String(120), nullable=True)
    signed_state = Column(String(40), nullable=True)
    document_numbers = Column(String(255), nullable=True)
    witnesses = Column(String(255), nullable=True)
    notes = Column(String(255), nullable=True)
    sensitive_topics = Column(String(255), nullable=True)
    contract_fields = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class ContractModel(Base):
    __tablename__ = "contract_models"

    id = Column(Integer, primary_key=True)
    key = Column(String(120), nullable=False)
    display_name = Column(String(180), nullable=False)
    model_type = Column(String(40), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    real_estate_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    base_fields = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    custom_fields = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    detection_keywords = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    model_prompt = Column(String(2000), nullable=True)


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
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    type = Column(String(20), nullable=False)
    status = Column(String(40), nullable=False)
    title = Column(String(160), nullable=False)
    description = Column(String(2000), nullable=False)
    offer_amount = Column(Numeric(12, 2), nullable=True)
    approved_amount = Column(Numeric(12, 2), nullable=True)
    assigned_interest_id = Column(Integer, ForeignKey("work_order_interests.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class WorkOrderQuote(Base):
    __tablename__ = "work_order_quotes"

    id = Column(Integer, primary_key=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    provider_name = Column(String(160), nullable=False)
    provider_phone = Column(String(40), nullable=False)
    lines = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class WorkOrderInterest(Base):
    __tablename__ = "work_order_interests"

    id = Column(Integer, primary_key=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    provider_name = Column(String(160), nullable=False)
    provider_phone = Column(String(40), nullable=False)
    status = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class WorkOrderProof(Base):
    __tablename__ = "work_order_proofs"

    id = Column(Integer, primary_key=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    provider_name = Column(String(160), nullable=False)
    provider_phone = Column(String(40), nullable=False)
    pix_key_type = Column(String(20), nullable=False)
    pix_key_value = Column(String(120), nullable=False)
    pix_receiver_name = Column(String(160), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    status = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class WorkOrderToken(Base):
    __tablename__ = "work_order_tokens"

    id = Column(Integer, primary_key=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    scope = Column(String(40), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    quote_id = Column(Integer, ForeignKey("work_order_quotes.id"), nullable=True)
    interest_id = Column(Integer, ForeignKey("work_order_interests.id"), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # TODO: define core activity fields beyond extras.
    extras = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
