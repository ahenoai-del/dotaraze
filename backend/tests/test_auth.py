import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.core.database import Base, get_db
from app.core.errors import ServiceError
from app.main import create_app
from app.models.account import Account, Session
from app.repositories import accounts
from app.services.identity import STEAM_BASE
from app.services.steam import NAMESPACE, STEAM_ENDPOINT, verify_assertion


def assertion():
    claimed = f'https://steamcommunity.com/openid/id/{STEAM_BASE + 123}'
    return {
        'openid.ns': NAMESPACE, 'openid.mode': 'id_res', 'openid.op_endpoint': STEAM_ENDPOINT,
        'openid.return_to': 'http://localhost:8000/callback', 'openid.claimed_id': claimed,
        'openid.identity': claimed, 'openid.response_nonce': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ') + 'random',
        'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
        'openid.assoc_handle': 'test', 'openid.sig': 'test',
    }


def verify(params, valid=True):
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, text=f'ns:{NAMESPACE}\nis_valid:{str(valid).lower()}\n'))) as client:
            return await verify_assertion(params, 'http://localhost:8000/callback', client)
    return asyncio.run(scenario())


def test_valid_steam_response():
    assert verify(assertion()) == STEAM_BASE + 123


@pytest.mark.parametrize('field,value', [
    ('openid.return_to', 'https://evil.test'), ('openid.op_endpoint', 'https://evil.test'),
    ('openid.identity', 'https://evil.test'), ('openid.claimed_id', 'https://steamcommunity.com/openid/id/00000000000000000'),
    ('openid.signed', 'identity'), ('openid.mode', 'cancel'), ('openid.response_nonce', '2020-01-01T00:00:00Zold'),
])
def test_forged_assertions_rejected(field, value):
    with pytest.raises(ServiceError):
        verify(assertion() | {field: value})


def test_steam_negative_verification_rejected():
    with pytest.raises(ServiceError):
        verify(assertion(), False)


@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with DBSession(engine) as session:
        yield session
    engine.dispose()


def test_state_is_single_use_and_sessions_are_hashed(db):
    token = accounts.create_login_state(db)
    assert accounts.consume_login_state(db, token)
    assert not accounts.consume_login_state(db, token)
    session_token = accounts.create_session(db, STEAM_BASE + 123)
    assert accounts.find_session(db, session_token)
    assert db.scalar(select(Session)).token_hash != session_token
    accounts.remove_account(db, STEAM_BASE + 123)
    assert accounts.find_session(db, session_token) is None
    assert db.get(Account, STEAM_BASE + 123) is None


def test_expired_session_denied(db):
    token = accounts.create_session(db, STEAM_BASE + 123)
    session = db.get(Session, accounts.digest(token))
    session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    assert accounts.find_session(db, token) is None


def test_routes_require_session_origin_and_state(db):
    app = create_app(Settings(environment='test', rate_limit_per_minute=100))
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        assert client.get('/api/auth/me').status_code == 401
        assert client.delete('/api/auth/account', headers={'Origin': 'https://evil.test'}).status_code == 403
        response = client.get('/api/auth/steam/callback?state=forged', follow_redirects=False)
        assert response.status_code == 303
        assert response.headers['location'] == 'http://localhost:5173/dashboard?auth_error=invalid_state'
        token = accounts.create_session(db, STEAM_BASE + 123)
        client.cookies.set('dotarise_session', token)
        assert client.get('/api/auth/me').json()['account_id'] == 123
        assert client.post('/api/auth/logout', headers={'Origin': 'http://localhost:5173'}).status_code == 204
        assert client.get('/api/auth/me').status_code == 401


def test_login_callback_replay_and_account_deletion(db):
    app = create_app(Settings(environment='test', rate_limit_per_minute=100))
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        response = client.get('/api/auth/steam/login', follow_redirects=False)
        assert response.status_code == 302
        state = client.cookies.get('dotarise_login')
        params = assertion() | {'state': state, 'openid.return_to': f'http://localhost:8000/api/auth/steam/callback?state={state}'}
        async def steam_post(*args, **kwargs):
            return httpx.Response(200, text=f'ns:{NAMESPACE}\nis_valid:true\n', request=httpx.Request('POST', STEAM_ENDPOINT))
        app.state.http.post = steam_post
        response = client.get('/api/auth/steam/callback', params=params, follow_redirects=False)
        assert response.status_code == 302
        assert 'HttpOnly' in response.headers['set-cookie']
        assert client.get('/api/auth/me').status_code == 200
        client.cookies.set('dotarise_login', state)
        replay = client.get('/api/auth/steam/callback', params=params, follow_redirects=False)
        assert replay.status_code == 303 and 'auth_error=invalid_state' in replay.headers['location']
        assert client.delete('/api/auth/account', headers={'Origin': 'http://localhost:5173'}).status_code == 204
        assert client.get('/api/auth/me').status_code == 401


def test_rate_limit_and_cors():
    app = create_app(Settings(environment='test', rate_limit_per_minute=1))
    with TestClient(app) as client:
        assert client.get('/api/players/bad/dashboard').status_code == 422
        response = client.get('/api/heroes', headers={'Origin': 'https://evil.test'})
        assert response.status_code == 429
        assert response.headers['Retry-After'] == '60'
        assert 'access-control-allow-origin' not in response.headers


def test_production_requires_secure_configuration():
    with pytest.raises(ValueError):
        Settings(environment='production', cookie_secure=False)
