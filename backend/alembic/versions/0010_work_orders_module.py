"""work orders module

Revision ID: 0010_work_orders_module
Revises: 0009_activity_log_user_fk
Create Date: 2026-02-05 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0010_work_orders_module"
down_revision = "0009_activity_log_user_fk"
branch_labels = None
depends_on = None


STATUS_DEFAULT = "quote_requested"
TYPE_DEFAULT = "quote"


def upgrade() -> None:
    op.create_table(
        "work_order_quotes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column("provider_name", sa.String(length=160), nullable=False),
        sa.Column("provider_phone", sa.String(length=40), nullable=False),
        sa.Column("lines", sa.dialects.postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_order_quotes_work_order_id", "work_order_quotes", ["work_order_id"])

    op.create_table(
        "work_order_interests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column("provider_name", sa.String(length=160), nullable=False),
        sa.Column("provider_phone", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_order_interests_work_order_id", "work_order_interests", ["work_order_id"])

    op.create_table(
        "work_order_proofs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column("provider_name", sa.String(length=160), nullable=False),
        sa.Column("provider_phone", sa.String(length=40), nullable=False),
        sa.Column("pix_key_type", sa.String(length=20), nullable=False),
        sa.Column("pix_key_value", sa.String(length=120), nullable=False),
        sa.Column("pix_receiver_name", sa.String(length=160), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_order_proofs_work_order_id", "work_order_proofs", ["work_order_id"])

    op.create_table(
        "work_order_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_order_id", sa.Integer(), sa.ForeignKey("work_orders.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("scope", sa.String(length=40), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quote_id", sa.Integer(), sa.ForeignKey("work_order_quotes.id"), nullable=True),
        sa.Column("interest_id", sa.Integer(), sa.ForeignKey("work_order_interests.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_work_order_tokens_hash"),
    )
    op.create_index("ix_work_order_tokens_token_hash", "work_order_tokens", ["token_hash"])

    op.add_column("work_orders", sa.Column("type", sa.String(length=20), nullable=False, server_default=TYPE_DEFAULT))
    op.add_column(
        "work_orders",
        sa.Column("status", sa.String(length=40), nullable=False, server_default=STATUS_DEFAULT),
    )
    op.add_column(
        "work_orders",
        sa.Column("title", sa.String(length=160), nullable=False, server_default="Legacy Work Order"),
    )
    op.add_column(
        "work_orders",
        sa.Column(
            "description", sa.String(length=2000), nullable=False, server_default="Legacy work order"
        ),
    )
    op.add_column("work_orders", sa.Column("offer_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("work_orders", sa.Column("approved_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("work_orders", sa.Column("assigned_interest_id", sa.Integer(), nullable=True))
    op.add_column("work_orders", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
    op.add_column(
        "work_orders",
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
    )
    op.add_column(
        "work_orders",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
    )
    op.create_index("ix_work_orders_property_id", "work_orders", ["property_id"])
    op.create_index("ix_work_orders_status", "work_orders", ["status"])

    op.create_foreign_key(
        "fk_work_orders_assigned_interest",
        "work_orders",
        "work_order_interests",
        ["assigned_interest_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_work_orders_created_by_user",
        "work_orders",
        "users",
        ["created_by_user_id"],
        ["id"],
    )

    bind = op.get_bind()
    user_id = bind.execute(sa.text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).scalar()
    if user_id is not None:
        bind.execute(
            sa.text(
                "UPDATE work_orders SET created_by_user_id = :uid WHERE created_by_user_id IS NULL"
            ),
            {"uid": user_id},
        )
        op.alter_column("work_orders", "created_by_user_id", nullable=False)



def downgrade() -> None:
    op.drop_constraint("fk_work_orders_created_by_user", "work_orders", type_="foreignkey")
    op.drop_constraint("fk_work_orders_assigned_interest", "work_orders", type_="foreignkey")

    op.drop_index("ix_work_orders_status", table_name="work_orders")
    op.drop_index("ix_work_orders_property_id", table_name="work_orders")

    op.drop_column("work_orders", "updated_at")
    op.drop_column("work_orders", "created_at")
    op.drop_column("work_orders", "created_by_user_id")
    op.drop_column("work_orders", "assigned_interest_id")
    op.drop_column("work_orders", "approved_amount")
    op.drop_column("work_orders", "offer_amount")
    op.drop_column("work_orders", "description")
    op.drop_column("work_orders", "title")
    op.drop_column("work_orders", "status")
    op.drop_column("work_orders", "type")

    op.drop_index("ix_work_order_tokens_token_hash", table_name="work_order_tokens")
    op.drop_table("work_order_tokens")

    op.drop_index("ix_work_order_proofs_work_order_id", table_name="work_order_proofs")
    op.drop_table("work_order_proofs")

    op.drop_index("ix_work_order_interests_work_order_id", table_name="work_order_interests")
    op.drop_table("work_order_interests")

    op.drop_index("ix_work_order_quotes_work_order_id", table_name="work_order_quotes")
    op.drop_table("work_order_quotes")
