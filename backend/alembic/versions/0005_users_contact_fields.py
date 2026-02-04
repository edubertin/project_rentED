"""add user contact fields

Revision ID: 0005_users_contact_fields
Revises: 0004_property_contracts
Create Date: 2026-02-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_users_contact_fields"
down_revision = "0004_property_contracts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=160), nullable=True))
    op.add_column("users", sa.Column("cpf", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "cpf")
    op.drop_column("users", "email")
