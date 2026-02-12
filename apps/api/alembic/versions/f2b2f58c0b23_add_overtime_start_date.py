"""add overtime start date

Revision ID: f2b2f58c0b23
Revises: 38b5bbf15b54
Create Date: 2026-02-12 10:57:47.977146

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b2f58c0b23'
down_revision: Union[str, Sequence[str], None] = '38b5bbf15b54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "user_settings",
        sa.Column("overtime_start_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user_settings", "overtime_start_date")
