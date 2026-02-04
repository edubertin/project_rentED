"""add property contracts

Revision ID: 0004_property_contracts
Revises: 0003_auth_users_sessions
Create Date: 2026-02-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0004_property_contracts"
down_revision = "0003_auth_users_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "property_contracts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("real_estate_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("model_key", sa.String(length=100), nullable=True),
        sa.Column("model_label", sa.String(length=160), nullable=True),
        sa.Column("real_estate_name", sa.String(length=160), nullable=True),
        sa.Column("contract_title", sa.String(length=255), nullable=True),
        sa.Column("document_platform", sa.String(length=80), nullable=True),
        sa.Column("document_code", sa.String(length=120), nullable=True),
        sa.Column("contract_number", sa.String(length=120), nullable=True),
        sa.Column("landlord_name", sa.String(length=160), nullable=True),
        sa.Column("landlord_cpf", sa.String(length=40), nullable=True),
        sa.Column("landlord_rg", sa.String(length=40), nullable=True),
        sa.Column("landlord_address", sa.String(length=255), nullable=True),
        sa.Column("tenant_name", sa.String(length=160), nullable=True),
        sa.Column("tenant_cpf", sa.String(length=40), nullable=True),
        sa.Column("tenant_rg", sa.String(length=40), nullable=True),
        sa.Column("tenant_address", sa.String(length=255), nullable=True),
        sa.Column("guarantor_name", sa.String(length=160), nullable=True),
        sa.Column("guarantor_cpf", sa.String(length=40), nullable=True),
        sa.Column("guarantor_rg", sa.String(length=40), nullable=True),
        sa.Column("administrator_name", sa.String(length=160), nullable=True),
        sa.Column("administrator_creci", sa.String(length=40), nullable=True),
        sa.Column("administrator_address", sa.String(length=255), nullable=True),
        sa.Column("admin_fee_percent", sa.String(length=40), nullable=True),
        sa.Column("guarantee_provider_name", sa.String(length=160), nullable=True),
        sa.Column("guarantee_provider_cnpj", sa.String(length=40), nullable=True),
        sa.Column("guarantee_provider_address", sa.String(length=255), nullable=True),
        sa.Column("guarantee_annex_reference", sa.String(length=120), nullable=True),
        sa.Column("payment_method", sa.String(length=80), nullable=True),
        sa.Column("includes_condominium", sa.Boolean(), nullable=True),
        sa.Column("includes_iptu", sa.Boolean(), nullable=True),
        sa.Column("late_fee_percent", sa.String(length=40), nullable=True),
        sa.Column("interest_percent_month", sa.String(length=40), nullable=True),
        sa.Column("tolerance_rule", sa.String(length=160), nullable=True),
        sa.Column("breach_penalty_months", sa.String(length=40), nullable=True),
        sa.Column("rent_amount_cents", sa.Integer(), nullable=True),
        sa.Column("rent_currency", sa.String(length=3), nullable=True),
        sa.Column("payment_day", sa.Integer(), nullable=True),
        sa.Column("indexation_type", sa.String(length=80), nullable=True),
        sa.Column("indexation_rate", sa.String(length=80), nullable=True),
        sa.Column("start_date", sa.String(length=40), nullable=True),
        sa.Column("end_date", sa.String(length=40), nullable=True),
        sa.Column("term_months", sa.Integer(), nullable=True),
        sa.Column("sign_date", sa.String(length=40), nullable=True),
        sa.Column("forum_city", sa.String(length=120), nullable=True),
        sa.Column("forum_state", sa.String(length=40), nullable=True),
        sa.Column("signed_city", sa.String(length=120), nullable=True),
        sa.Column("signed_state", sa.String(length=40), nullable=True),
        sa.Column("document_numbers", sa.String(length=255), nullable=True),
        sa.Column("witnesses", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("sensitive_topics", sa.String(length=255), nullable=True),
        sa.Column(
            "contract_fields",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.UniqueConstraint("property_id", name="uq_property_contracts_property_id"),
    )
    op.create_index(
        "ix_property_contracts_model_key",
        "property_contracts",
        ["model_key"],
    )
    op.create_index(
        "ix_property_contracts_document_code",
        "property_contracts",
        ["document_code"],
    )


def downgrade() -> None:
    op.drop_index("ix_property_contracts_document_code", table_name="property_contracts")
    op.drop_index("ix_property_contracts_model_key", table_name="property_contracts")
    op.drop_table("property_contracts")
