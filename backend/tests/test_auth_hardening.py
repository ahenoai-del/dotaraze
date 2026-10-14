from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.database import get_db
from app.main import create_app
from app.repositories import accounts
from app.services.steam import NAMESPACE, STEAM_ENDPOINT
from app.services.identity import STEAM_BASE
from test_auth import assertion, db  # noqa: F401 (shared isolated fixture)


def auth_app(db, production=False):
    settings = Settings(environment='production' if production else 'test', cookie_secure=production,
                        frontend_url='https://app.example.com' if production else 'http://localhost:5173',
                        backend_url='https://app.example.com' if production else 'http://localhost:8000',
                        cors_origins=['https://app.example.com'] if production else ['http://localhost:5173'],
                        rate_limit_per_minute=100)
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    return app


@pytest.mark.parametrize('mode,code', [('cancel', 'cancelled'), ('id_res', 'steam_unavailable')])
def test_cancel_or_steam_timeout_returns_to_frontend(db, mode, code):
    app = auth_app(db)
    with TestClient(app) as client:
        client.get('/api/auth/steam/login', follow_redirects=False)
        state = client.cookies.get('dotarise_login')
        params = assertion() | {'state': state, 'openid.mode': mode,
                                'openid.return_to': f'http://localhost:8000/api/auth/steam/callback?state={state}'}
        async def timeout(*args, **kwargs):
            raise httpx.ReadTimeout('simulated')
        app.state.http.post = timeout
        response = client.get('/api/auth/steam/callback', params=params, follow_redirects=False)
        assert response.status_code == 303
        assert response.headers['location'] == f'http://localhost:5173/dashboard?auth_error={code}'
        assert client.get('/api/auth/me').status_code == 401
        assert not accounts.consume_login_state(db, state)
        assert client.cookies.get('dotarise_login') is None


def test_unicode_and_duplicate_state_fail_without_crashing(db):
    with TestClient(auth_app(db)) as client:
        client.cookies.set('dotarise_login', 'a' * 43)
        response = client.get('/api/auth/steam/callback', params={'state': 'я' * 43}, follow_redirects=False)
        assert response.status_code == 303 and 'invalid_state' in response.headers['location']
        response = client.get('/api/auth/steam/callback?state=a&state=b', follow_redirects=False)
        assert response.status_code == 303 and 'invalid_login' in response.headers['location']


def test_production_callback_cookies_and_revocation_of_all_sessions(db):
    app = auth_app(db, production=True)
    with TestClient(app, base_url='https://app.example.com') as client:
        login = client.get('/api/auth/steam/login', follow_redirects=False)
        query = parse_qs(urlsplit(login.headers['location']).query)
        assert query['openid.realm'] == ['https://app.example.com']
        assert query['openid.return_to'][0].startswith('https://app.example.com/api/auth/steam/callback?state=')
        assert all(flag in login.headers['set-cookie'] for flag in ('HttpOnly', 'Secure', 'SameSite=lax', 'Path=/api/auth'))
        state = client.cookies.get('dotarise_login')
        params = assertion() | {'state': state, 'openid.return_to': query['openid.return_to'][0]}
        async def confirm(*args, **kwargs):
            assert args[0] == STEAM_ENDPOINT and kwargs['data']['openid.mode'] == 'check_authentication'
            return httpx.Response(200, text=f'ns:{NAMESPACE}\nis_valid:true\n', request=httpx.Request('POST', STEAM_ENDPOINT))
        app.state.http.post = confirm
        response = client.get('/api/auth/steam/callback', params=params, follow_redirects=False)
        assert response.status_code == 302 and response.headers['location'] == 'https://app.example.com/dashboard'
        assert all(flag in response.headers['set-cookie'] for flag in ('HttpOnly', 'Secure', 'SameSite=lax', 'Path=/api'))
        assert client.get('/api/auth/me').json()['account_id'] == 123
        other_token = accounts.create_session(db, STEAM_BASE + 123)
        assert client.delete('/api/auth/account', headers={'Origin': 'https://evil.test'}).status_code == 403
        assert client.delete('/api/auth/account').status_code == 403
        deleted = client.delete('/api/auth/account', headers={'Origin': 'https://app.example.com'})
        assert deleted.status_code == 204 and 'Secure' in deleted.headers['set-cookie']
        assert accounts.find_session(db, other_token) is None
        assert client.get('/api/auth/me').status_code == 401
