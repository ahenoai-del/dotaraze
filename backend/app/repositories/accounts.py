import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models.account import Account, LoginState, Session


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_login_state(db: DBSession) -> str:
    now = datetime.now(timezone.utc)
    db.execute(delete(LoginState).where(LoginState.expires_at <= now))
    db.execute(delete(Session).where(Session.expires_at <= now))
    token = secrets.token_urlsafe(32)
    db.add(LoginState(token_hash=digest(token), expires_at=now + timedelta(minutes=10)))
    db.commit()
    return token


def consume_login_state(db: DBSession, token: str) -> bool:
    consumed = db.execute(delete(LoginState).where(
        LoginState.token_hash == digest(token),
        LoginState.expires_at > datetime.now(timezone.utc),
    ).returning(LoginState.token_hash)).scalar_one_or_none()
    db.commit()
    return consumed is not None


def create_session(db: DBSession, steam_id: int) -> str:
    # Concurrent first logins must share one account instead of racing SELECT/INSERT.
    insert = sqlite_insert if db.get_bind().dialect.name == 'sqlite' else postgres_insert
    db.execute(insert(Account).values(steam_id=steam_id).on_conflict_do_nothing(index_elements=['steam_id']))
    token = secrets.token_urlsafe(32)
    db.add(Session(token_hash=digest(token), steam_id=steam_id,
                   expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    db.commit()
    return token


def find_session(db: DBSession, token: str | None) -> Session | None:
    if not token:
        return None
    session = db.get(Session, digest(token))
    if not session:
        return None
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return session if expires > datetime.now(timezone.utc) else None


def revoke(db: DBSession, token: str):
    db.execute(delete(Session).where(Session.token_hash == digest(token)))
    db.commit()


def remove_account(db: DBSession, steam_id: int):
    db.execute(delete(Session).where(Session.steam_id == steam_id))
    db.execute(delete(Account).where(Account.steam_id == steam_id))
    db.commit()
