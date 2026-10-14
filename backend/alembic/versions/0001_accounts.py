"""Accounts, opaque sessions and single-use OpenID states."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('accounts',
        sa.Column('steam_id', sa.BigInteger(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table('login_states',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_login_states_expires_at', 'login_states', ['expires_at'])
    op.create_table('sessions',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('steam_id', sa.BigInteger(), sa.ForeignKey('accounts.steam_id', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_sessions_steam_id', 'sessions', ['steam_id'])
    op.create_index('ix_sessions_expires_at', 'sessions', ['expires_at'])


def downgrade():
    op.drop_table('sessions')
    op.drop_table('login_states')
    op.drop_table('accounts')
