"""Check the real login redirect without logging tokens or authenticating a user."""
import argparse
from urllib.parse import parse_qs, urlsplit

import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--origin', default='http://localhost:8001')
args = parser.parse_args()
origin = args.origin.rstrip('/')
is_loopback = urlsplit(origin).hostname in ('localhost', '127.0.0.1', '::1')
with httpx.Client(timeout=20, follow_redirects=False, trust_env=not is_loopback) as client:
    response = client.get(origin + '/api/auth/steam/login')
    if response.status_code != 302:
        raise SystemExit(f'Login endpoint status: {response.status_code}; expected 302')
    target = response.headers['location']
    parsed = urlsplit(target)
    query = parse_qs(parsed.query)
    assert parsed.scheme == 'https' and parsed.netloc == 'steamcommunity.com' and parsed.path == '/openid/login'
    assert query['openid.realm'] == [origin]
    callback = query['openid.return_to'][0]
    assert callback.startswith(origin + '/api/auth/steam/callback?state=')
    assert client.cookies.get('dotarise_login')
    print('Local login: 302; Steam HTTPS endpoint, realm, callback and state cookie verified.')
    try:
        with httpx.Client(timeout=20, follow_redirects=False) as provider_client:
            provider = provider_client.get(target)
    except httpx.HTTPError as exc:
        raise SystemExit(f'Steam network check failed: {type(exc).__name__}') from None
    print(f'Steam provider HTTP status: {provider.status_code}; no account credentials supplied.')
    if provider.status_code not in (200, 302, 303):
        raise SystemExit('Steam did not accept the unauthenticated authorization request.')
    print('Manual user login and callback are still required; this probe does not establish a session.')
