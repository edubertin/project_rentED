"""add contract models

Revision ID: 0006_contract_models
Revises: 0005_users_contact_fields
Create Date: 2026-02-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0006_contract_models"
down_revision = "0005_users_contact_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contract_models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=180), nullable=False),
        sa.Column("model_type", sa.String(length=40), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "base_fields",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "custom_fields",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "detection_keywords",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("model_prompt", sa.String(length=2000), nullable=True),
        sa.UniqueConstraint("key", "version", name="uq_contract_models_key_version"),
    )
    op.create_index("ix_contract_models_key", "contract_models", ["key"])
    op.create_index("ix_contract_models_active", "contract_models", ["is_active"])
    op.add_column(
        "property_contracts",
        sa.Column("contract_model_id", sa.Integer(), sa.ForeignKey("contract_models.id"), nullable=True),
    )

    op.execute(
        """
        INSERT INTO contract_models
            (key, display_name, model_type, version, is_active, base_fields, custom_fields, detection_keywords, model_prompt)
        VALUES
            (
                'generic_contract_v1',
                'Generic rental contract',
                'contract',
                1,
                true,
                '[]'::jsonb,
                '[]'::jsonb,
                '[]'::jsonb,
                NULL
            ),
            (
                'ms_imoveis_carta_fianca_avalyst_v1',
                'MS Imóveis — Residencial com Carta Fiança (Avalyst)',
                'contract',
                1,
                true,
                '[]'::jsonb,
                '[]'::jsonb,
                '["IMOBILIARIA MS","CARTA FIANCA","AVALYST","A.J DE SA ADMINISTRACAO DE IMOVEIS"]'::jsonb,
                NULL
            );
        """
    )


def downgrade() -> None:
    op.drop_constraint("property_contracts_contract_model_id_fkey", "property_contracts", type_="foreignkey")
    op.drop_column("property_contracts", "contract_model_id")
    op.drop_index("ix_contract_models_active", table_name="contract_models")
    op.drop_index("ix_contract_models_key", table_name="contract_models")
    op.drop_table("contract_models")
