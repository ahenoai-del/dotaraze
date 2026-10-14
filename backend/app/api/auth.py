import secrets
import re
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import ServiceError
from app.repositories import accounts
from app.services.identity import STEAM_BASE
from app.services.steam import login_url, verify_assertion

router = APIRouter(prefix='/auth', tags=['Authentication'])
COOKIE = 'dotarise_session'
STATE_COOKIE = 'dotarise_login'


def current_session(request: Request, db: Session = Depends(get_db)):
    session = accounts.find_session(db, request.cookies.get(COOKIE))
    if session is None:
        raise ServiceError('unauthorized', 'Войдите через Steam.', 401)
    return session


def require_origin(request: Request):
    if request.headers.get('origin') != request.app.state.settings.frontend_url:
        raise ServiceError('invalid_origin', 'Запрос с этого сайта запрещён.', 403)


def callback_url(request: Request, state: str):
    return request.app.state.settings.backend_url + '/api/auth/steam/callback?' + urlencode({'state': state})


def clear_cookie(response: Response, request: Request, name: str, path: str):
    response.delete_cookie(name, path=path, httponly=True,
                           secure=request.app.state.settings.cookie_secure, samesite='lax')


def login_failure(request: Request, code: str):
    # Only server-defined error codes enter the frontend URL; no assertion or user return URL.
    response = RedirectResponse(request.app.state.settings.frontend_url + '/dashboard?' + urlencode({'auth_error': code}), status_code=303)
    clear_cookie(response, request, STATE_COOKIE, '/api/auth')
    return response


@router.get('/steam/login')
def steam_login(request: Request, db: Session = Depends(get_db)):
    settings = request.app.state.settings
    state = accounts.create_login_state(db)
    response = RedirectResponse(login_url(callback_url(request, state), settings.backend_url), status_code=302)
    response.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True,
                        secure=settings.cookie_secure, samesite='lax', path='/api/auth')
    response.headers['Cache-Control'] = 'no-store'
    return response


@router.get('/steam/callback')
async def steam_callback(request: Request, db: Session = Depends(get_db)):
    if any(len(request.query_params.getlist(key)) != 1 for key in request.query_params):
        return login_failure(request, 'invalid_login')
    state = request.query_params.get('state', '')
    cookie = request.cookies.get(STATE_COOKIE, '')
    if (not re.fullmatch(r'[A-Za-z0-9_-]{43}', state) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', cookie)
            or not secrets.compare_digest(state, cookie)):
        return login_failure(request, 'invalid_state')
    # Consume atomically before network I/O. Replays and parallel callbacks fail closed.
    if not accounts.consume_login_state(db, state):
        return login_failure(request, 'invalid_state')
    if request.query_params.get('openid.mode') == 'cancel':
        return login_failure(request, 'cancelled')
    try:
        steam_id = await verify_assertion(dict(request.query_params), callback_url(request, state), request.app.state.http)
    except ServiceError as exc:
        return login_failure(request, 'steam_unavailable' if exc.code == 'steam_unavailable' else 'invalid_login')
    token = accounts.create_session(db, steam_id)
    response = RedirectResponse(request.app.state.settings.frontend_url + '/dashboard', status_code=302)
    response.set_cookie(COOKIE, token, max_age=604800, httponly=True,
                        secure=request.app.state.settings.cookie_secure, samesite='lax', path='/api')
    clear_cookie(response, request, STATE_COOKIE, '/api/auth')
    response.headers['Cache-Control'] = 'no-store'
    return response


@router.get('/me')
def me(session=Depends(current_session)):
    return {'steam_id': str(session.steam_id), 'account_id': session.steam_id - STEAM_BASE, 'plan': 'free'}


@router.post('/logout', status_code=204, dependencies=[Depends(require_origin)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    if token:
        accounts.revoke(db, token)
    clear_cookie(response, request, COOKIE, '/api')


@router.delete('/account', status_code=204, dependencies=[Depends(require_origin)])
def delete_account(request: Request, response: Response, session=Depends(current_session), db: Session = Depends(get_db)):
    accounts.remove_account(db, session.steam_id)
    clear_cookie(response, request, COOKIE, '/api')
