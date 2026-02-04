"""contract models real estate

Revision ID: 0007_contract_models_real_estate
Revises: 0006_contract_models
Create Date: 2026-02-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0007_contract_models_real_estate"
down_revision = "0006_contract_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contract_models",
        sa.Column("real_estate_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_constraint("contract_models_real_estate_user_id_fkey", "contract_models", type_="foreignkey")
    op.drop_column("contract_models", "real_estate_user_id")
