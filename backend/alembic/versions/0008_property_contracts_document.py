"""add property contract document link

Revision ID: 0008_property_contracts_document
Revises: 0007_contract_models_real_estate
Create Date: 2026-02-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_property_contracts_document"
down_revision = "0007_contract_models_real_estate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "property_contracts",
        sa.Column("document_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "property_contracts_document_id_fkey",
        "property_contracts",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "property_contracts_document_id_fkey",
        "property_contracts",
        type_="foreignkey",
    )
    op.drop_column("property_contracts", "document_id")
