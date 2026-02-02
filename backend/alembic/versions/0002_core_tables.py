"""create core tables

Revision ID: 0002_core_tables
Revises: 0001_create_items
Create Date: 2026-02-02 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002_core_tables"
down_revision = "0001_create_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "properties",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("property_id", sa.Integer, sa.ForeignKey("properties.id"), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "document_extractions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("document_id", sa.Integer, sa.ForeignKey("documents.id"), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "work_orders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("property_id", sa.Integer, sa.ForeignKey("properties.id"), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("work_order_id", sa.Integer, sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "activity_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "extras",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_table("activity_log")
    op.drop_table("expenses")
    op.drop_table("work_orders")
    op.drop_table("document_extractions")
    op.drop_table("documents")
    op.drop_table("properties")
    op.drop_table("users")
