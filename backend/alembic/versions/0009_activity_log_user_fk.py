"""Set activity_log.user_id FK to SET NULL

Revision ID: 0009_activity_log_user_fk
Revises: 0008_property_contracts_document
Create Date: 2026-02-04 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0009_activity_log_user_fk"
down_revision = "0008_property_contracts_document"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("activity_log_user_id_fkey", "activity_log", type_="foreignkey")
    op.create_foreign_key(
        "activity_log_user_id_fkey",
        "activity_log",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("activity_log_user_id_fkey", "activity_log", type_="foreignkey")
    op.create_foreign_key(
        "activity_log_user_id_fkey",
        "activity_log",
        "users",
        ["user_id"],
        ["id"],
    )
