"""add auth fields and sessions

Revision ID: 0003_auth_users_sessions
Revises: 0002_core_tables
Create Date: 2026-02-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_auth_users_sessions"
down_revision = "0002_core_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("username", sa.String(length=80), nullable=False, server_default=""),
    )
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=False, server_default=""),
    )
    op.add_column(
        "users",
        sa.Column("name", sa.String(length=120), nullable=False, server_default=""),
    )
    op.add_column(
        "users",
        sa.Column("cell_number", sa.String(length=20), nullable=False, server_default=""),
    )
    op.execute(
        """
        UPDATE users
        SET username = 'user_' || id
        WHERE username IS NULL OR username = '';
        """
    )
    op.alter_column("users", "username", server_default=None)
    op.alter_column("users", "password_hash", server_default=None)
    op.alter_column("users", "name", server_default=None)
    op.alter_column("users", "cell_number", server_default=None)
    op.create_unique_constraint("uq_users_username", "users", ["username"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sessions")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "cell_number")
    op.drop_column("users", "name")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")
