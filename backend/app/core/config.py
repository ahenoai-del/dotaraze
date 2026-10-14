from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / '.env', extra='ignore'
    )
    environment: Literal['development', 'production', 'test'] = 'development'
    database_url: str = 'postgresql+psycopg://dotarise:dotarise@localhost:5432/dotarise'
    frontend_url: str = 'http://localhost:5173'
    backend_url: str = 'http://localhost:8000'
    cors_origins: list[str] = ['http://localhost:5173']
    cookie_secure: bool = False
    opendota_base_url: str = 'https://api.opendota.com/api'
    opendota_api_key: str = ''
    cache_ttl_seconds: int = 120
    rate_limit_per_minute: int = 30
    static_dir: Path | None = None
    client_ip_source: Literal['connection', 'railway'] = 'connection'

    @field_validator('database_url')
    @classmethod
    def psycopg_driver(cls, value: str):
        for prefix in ('postgres://', 'postgresql://'):
            if value.startswith(prefix):
                return 'postgresql+psycopg://' + value[len(prefix):]
        return value

    @field_validator('frontend_url', 'backend_url')
    @classmethod
    def canonical_url(cls, value: str):
        from urllib.parse import urlsplit
        value = value.rstrip('/')
        parsed = urlsplit(value)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.path:
            raise ValueError('Use an HTTP(S) origin without credentials, path or query')
        return value

    @model_validator(mode='after')
    def production_security(self):
        if self.client_ip_source == 'railway' and self.environment != 'production':
            raise ValueError('Railway client IP mode is only for production behind Railway HTTP ingress')
        if self.environment == 'production':
            if not self.cookie_secure or not self.backend_url.startswith('https://') or not self.frontend_url.startswith('https://'):
                raise ValueError('Production requires HTTPS and COOKIE_SECURE=true')
            if '*' in self.cors_origins:
                raise ValueError('Wildcard CORS is forbidden')
            if self.frontend_url not in self.cors_origins:
                raise ValueError('CORS_ORIGINS must include FRONTEND_URL')
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
