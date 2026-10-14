import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api import auth, players, meta
from app.core.config import Settings, get_settings
from app.core.database import SessionLocal
from app.core.errors import ServiceError
from app.core.limits import RateLimiter, client_key
from app.core.static import SPAStaticFiles
from app.services.opendota import OpenDota

logger = logging.getLogger('dotarise')
logging.basicConfig(level=logging.INFO, format='%(message)s')
# HTTP client logs can contain API keys in query strings.
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(timeout=httpx.Timeout(10), follow_redirects=False) as client:
            app.state.http = client
            app.state.opendota = OpenDota(client, settings)
            yield

    app = FastAPI(title='DotaRise API', version='0.1.0', lifespan=lifespan)
    app.state.settings = settings
    limiter = RateLimiter(settings.rate_limit_per_minute)

    @app.middleware('http')
    async def request_context(request: Request, call_next):
        started = time.monotonic()
        request_id = uuid.uuid4().hex
        if (request.url.path.startswith('/api/') and request.url.path != '/api/health'
                and not limiter.allow(client_key(request, settings.client_ip_source))):
            response = JSONResponse({'error': {'code': 'rate_limit', 'message': 'Слишком много запросов. Повторите через минуту.'}}, 429,
                                    headers={'Retry-After': '60'})
        else:
            response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        else:
            response.headers.setdefault('Cache-Control', 'no-store')
        if settings.environment == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        # Do not log callback query strings, cookies, profile names, or identifiers.
        logger.info(json.dumps({'event': 'request', 'request_id': request_id, 'method': request.method,
                                'status': response.status_code, 'duration_ms': round((time.monotonic() - started) * 1000)}))
        return response

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=['GET', 'POST', 'DELETE'], allow_headers=['Content-Type'])

    @app.exception_handler(ServiceError)
    async def service_error(request, exc):
        return JSONResponse({'error': {'code': exc.code, 'message': exc.message}}, exc.status)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        logger.error(json.dumps({'event': 'database_unavailable', 'type': type(exc).__name__}))
        return JSONResponse({'error': {'code': 'database_unavailable', 'message': 'База данных недоступна. Повторите позже.'}}, 503)

    @app.get('/api/health', tags=['Health'])
    def health():
        try:
            with SessionLocal() as db:
                db.execute(text('SELECT 1'))
            return {'status': 'ok', 'database': 'connected'}
        except SQLAlchemyError:
            return JSONResponse({'status': 'degraded', 'database': 'unavailable'}, 503)

    app.include_router(players.router, prefix='/api')
    app.include_router(auth.router, prefix='/api')
    app.include_router(meta.router, prefix='/api')
    if settings.static_dir is not None:
        if not (settings.static_dir / 'index.html').is_file():
            raise RuntimeError('STATIC_DIR must contain a built frontend index.html')
        app.mount('/', SPAStaticFiles(directory=settings.static_dir, html=True), name='frontend')
    return app


app = create_app()
