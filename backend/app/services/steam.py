import re
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from app.core.errors import ServiceError
from app.services.identity import account_id

STEAM_ENDPOINT = 'https://steamcommunity.com/openid/login'
NAMESPACE = 'http://specs.openid.net/auth/2.0'


def login_url(return_to: str, realm: str) -> str:
    return STEAM_ENDPOINT + '?' + urlencode({
        'openid.ns': NAMESPACE, 'openid.mode': 'checkid_setup',
        'openid.return_to': return_to, 'openid.realm': realm,
        'openid.identity': NAMESPACE + '/identifier_select',
        'openid.claimed_id': NAMESPACE + '/identifier_select',
    })


async def verify_assertion(params: dict[str, str], expected_return: str, client: httpx.AsyncClient) -> int:
    def invalid():
        return ServiceError('invalid_login', 'Steam не подтвердил вход. Начните авторизацию заново.', 400)

    required_signed = {'op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'}
    if (params.get('openid.ns') != NAMESPACE or params.get('openid.mode') != 'id_res'
            or params.get('openid.op_endpoint') != STEAM_ENDPOINT
            or params.get('openid.return_to') != expected_return
            or not required_signed <= set(params.get('openid.signed', '').split(','))):
        raise invalid()
    claimed = params.get('openid.claimed_id', '')
    match = re.fullmatch(r'https://steamcommunity\.com/openid/id/([0-9]{17})', claimed)
    if not match or params.get('openid.identity') != claimed:
        raise invalid()
    steam_id = int(match[1])
    account_id(str(steam_id))
    try:
        nonce_time = datetime.strptime(params.get('openid.response_nonce', '')[:20], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - nonce_time).total_seconds()
        if not -60 <= age <= 600:
            raise invalid()
    except ValueError as exc:
        raise invalid() from exc
    payload = {k: v for k, v in params.items() if k.startswith('openid.')}
    payload['openid.mode'] = 'check_authentication'
    try:
        response = await client.post(STEAM_ENDPOINT, data=payload)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ServiceError('steam_unavailable', 'Steam временно не отвечает. Повторите вход позже.', 503) from exc
    fields = dict(line.split(':', 1) for line in response.text.splitlines() if ':' in line)
    if fields.get('is_valid') != 'true' or fields.get('ns') != NAMESPACE:
        raise invalid()
    return steam_id
