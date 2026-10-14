from contextlib import contextmanager
from pathlib import Path
import shutil
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.config import Settings
from app.core.limits import client_key
from app.main import create_app


@pytest.fixture
def build_directory():
    # Workspace-local, inherited permissions: also runs in restricted Windows sessions.
    root = Path(__file__).resolve().parents[2] / '.local' / 'deployment-tests'
    root.mkdir(parents=True, exist_ok=True)
    directory = root / uuid.uuid4().hex
    directory.mkdir()
    try:
        yield directory
    finally:
        if directory.resolve().parent != root.resolve():
            raise RuntimeError('Refusing cleanup outside the test directory')
        shutil.rmtree(directory)


@pytest.fixture
def frontend_build(build_directory):
    (build_directory / 'assets').mkdir()
    (build_directory / 'index.html').write_text('<!doctype html><title>DotaRise test build</title>', encoding='utf-8')
    (build_directory / 'assets' / 'index-abc.js').write_text('console.log("build")', encoding='utf-8')
    (build_directory / '.env').write_text('not-public', encoding='utf-8')
    return build_directory


def test_same_origin_build_routing_cache_and_api_boundaries(frontend_build):
    app = create_app(Settings(static_dir=frontend_build, rate_limit_per_minute=100))
    with TestClient(app) as client:
        for path in ('/', '/dashboard', '/privacy'):
            response = client.get(path, headers={'Accept': 'text/html'})
            assert response.status_code == 200 and 'DotaRise test build' in response.text
            assert response.headers['cache-control'] == 'no-cache'
        asset = client.get('/assets/index-abc.js')
        assert asset.status_code == 200 and 'immutable' in asset.headers['cache-control']
        for path in ('/api/unknown', '/assets/missing.js', '/.env', '/%2e%2e/.env'):
            response = client.get(path, headers={'Accept': 'text/html'})
            assert response.status_code == 404
            assert 'DotaRise test build' not in response.text and 'not-public' not in response.text
        assert client.get('/unknown', headers={'Accept': 'application/json'}).status_code == 404
        assert client.post('/dashboard').status_code == 405
        assert client.get('/docs').status_code == 200
        assert client.get('/api/auth/me').status_code == 401


def test_missing_build_fails_before_startup(build_directory):
    with pytest.raises(RuntimeError, match='built frontend'):
        create_app(Settings(static_dir=build_directory))


def test_health_is_not_rate_limited(monkeypatch):
    class Database:
        def execute(self, statement):
            return None
    @contextmanager
    def session():
        yield Database()
    monkeypatch.setattr('app.main.SessionLocal', session)
    with TestClient(create_app(Settings(rate_limit_per_minute=1))) as client:
        assert client.get('/api/players/bad/dashboard').status_code == 422
        assert client.get('/api/heroes').status_code == 429
        for _ in range(3):
            assert client.get('/api/health').status_code == 200


def test_cors_and_https_headers():
    settings = Settings(environment='production', cookie_secure=True,
                        frontend_url='https://app.example.com', backend_url='https://app.example.com',
                        cors_origins=['https://app.example.com'])
    with TestClient(create_app(settings), base_url='https://app.example.com') as client:
        response = client.options('/api/auth/account', headers={
            'Origin': 'https://app.example.com', 'Access-Control-Request-Method': 'DELETE',
        })
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'https://app.example.com'
        assert response.headers['access-control-allow-credentials'] == 'true'
        bad = client.options('/api/auth/account', headers={'Origin': 'https://evil.test', 'Access-Control-Request-Method': 'DELETE'})
        assert bad.status_code == 400 and 'access-control-allow-origin' not in bad.headers
        normal = client.get('/api/players/bad/dashboard')
        assert normal.headers['strict-transport-security'] == 'max-age=31536000'


def test_ip_headers_require_opt_in_and_one_valid_ip():
    def request(headers):
        return Request({'type': 'http', 'client': ('10.0.0.1', 123), 'headers': headers})
    valid = request([(b'x-real-ip', b'203.0.113.2'), (b'x-forwarded-for', b'198.51.100.1')])
    assert client_key(valid, 'connection') == '10.0.0.1'
    assert client_key(valid, 'railway') == '203.0.113.2'
    for headers in ([], [(b'x-real-ip', b'bad')], [(b'x-real-ip', b'1.2.3.4, 5.6.7.8')],
                    [(b'x-real-ip', b'1.2.3.4'), (b'x-real-ip', b'5.6.7.8')]):
        assert client_key(request(headers), 'railway') == '10.0.0.1'


def test_bad_production_origins_rejected():
    with pytest.raises(ValueError):
        Settings(environment='production', cookie_secure=True, frontend_url='https://app.example.com',
                 backend_url='https://api.example.com', cors_origins=['https://unrelated.example.com'])
