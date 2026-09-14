"""add webhook source and token

Revision ID: c3a9e1b7f042
Revises: 16279d9e2d25
Create Date: 2026-08-27 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3a9e1b7f042"
down_revision: Union[str, Sequence[str], None] = "16279d9e2d25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clock_events",
        sa.Column("source", sa.String(length=16), nullable=False, server_default="app"),
    )

    op.create_table(
        "webhook_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_webhook_tokens_token"), "webhook_tokens", ["token"], unique=True)
    op.create_index(op.f("ix_webhook_tokens_user_id"), "webhook_tokens", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_webhook_tokens_user_id"), table_name="webhook_tokens")
    op.drop_index(op.f("ix_webhook_tokens_token"), table_name="webhook_tokens")
    op.drop_table("webhook_tokens")
    op.drop_column("clock_events", "source")
