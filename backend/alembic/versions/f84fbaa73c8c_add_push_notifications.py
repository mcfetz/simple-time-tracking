"""add push notifications

Revision ID: f84fbaa73c8c
Revises: 2f06e12c33fb
Create Date: 2026-02-17 20:46:44.680262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f84fbaa73c8c'
down_revision: Union[str, Sequence[str], None] = '2f06e12c33fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "user_settings",
        sa.Column("push_work_minutes", sa.JSON(), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("push_break_minutes", sa.JSON(), nullable=True),
    )

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.String(length=2048), nullable=False),
        sa.Column("p256dh", sa.String(length=512), nullable=False),
        sa.Column("auth", sa.String(length=256), nullable=False),
        sa.Column("lang", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
    )
    op.create_index(
        op.f("ix_push_subscriptions_user_id"),
        "push_subscriptions",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "push_notification_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("date_local", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(length=8), nullable=False),
        sa.Column("threshold_minutes", sa.Integer(), nullable=False),
        sa.Column("sent_at_utc", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["push_subscriptions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_push_notification_logs_date_local"),
        "push_notification_logs",
        ["date_local"],
        unique=False,
    )
    op.create_index(
        op.f("ix_push_notification_logs_subscription_id"),
        "push_notification_logs",
        ["subscription_id"],
        unique=False,
    )
    op.create_index(
        "uq_push_notification_log_subscription_date_kind_threshold",
        "push_notification_logs",
        ["subscription_id", "date_local", "kind", "threshold_minutes"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "uq_push_notification_log_subscription_date_kind_threshold",
        table_name="push_notification_logs",
    )
    op.drop_index(
        op.f("ix_push_notification_logs_subscription_id"),
        table_name="push_notification_logs",
    )
    op.drop_index(
        op.f("ix_push_notification_logs_date_local"),
        table_name="push_notification_logs",
    )
    op.drop_table("push_notification_logs")

    op.drop_index(
        op.f("ix_push_subscriptions_user_id"),
        table_name="push_subscriptions",
    )
    op.drop_table("push_subscriptions")

    op.drop_column("user_settings", "push_break_minutes")
    op.drop_column("user_settings", "push_work_minutes")
