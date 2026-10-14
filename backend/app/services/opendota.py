import asyncio
from datetime import datetime, timezone

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.limits import ResponseCache
from app.schemas.player import Dashboard, Profile
from app.services.statistics import hero_statistics, normalize_match, summarize


class OpenDota:
    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self.cache = ResponseCache(settings.cache_ttl_seconds)

    async def get(self, path: str, params: dict | None = None):
        query = dict(params or {})
        if self.settings.opendota_api_key:
            query['api_key'] = self.settings.opendota_api_key
        for attempt in range(3):
            try:
                response = await self.client.get(self.settings.opendota_base_url + path, params=query)
                if response.status_code == 429:
                    raise ServiceError('upstream_limit', 'Лимит OpenDota исчерпан. Повторите запрос позже.', 503)
                if response.status_code in (403, 404):
                    raise ServiceError('profile_unavailable', 'Публичный профиль недоступен в OpenDota.', 404)
                response.raise_for_status()
                return response.json()
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError, ValueError) as exc:
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500:
                    break
                if attempt < 2:
                    await asyncio.sleep(0.25 * (2 ** attempt))
        raise ServiceError('upstream_unavailable', 'OpenDota временно не отвечает. Попробуйте позже.', 503)

    async def dashboard(self, player_id: int) -> Dashboard:
        async def load():
            profile = await self.get(f'/players/{player_id}')
            if not isinstance(profile, dict) or not isinstance(profile.get('profile'), dict):
                raise ServiceError('profile_unavailable', 'Профиль не найден или не опубликован в OpenDota.', 404)
            rows = await self.get(f'/players/{player_id}/matches', {
                'limit': 100, 'significant': 1,
                'project': ['hero_id', 'start_time', 'kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min'],
            })
            if not isinstance(rows, list):
                raise ServiceError('upstream_format', 'OpenDota вернул неожиданный формат данных.')
            try:
                matches = [normalize_match(row) for row in rows]
                result = Dashboard(
                    profile=Profile(account_id=player_id, name=profile['profile'].get('personaname') or f'Игрок {player_id}',
                                    avatar=profile['profile'].get('avatarfull'), rank_tier=profile.get('rank_tier')),
                    matches=matches, summary=summarize(matches), heroes=hero_statistics(matches),
                    fetched_at=datetime.now(timezone.utc).isoformat(),
                    notice='Нет доступных матчей. История может быть скрыта или ещё не собрана OpenDota.' if not matches else None,
                )
            except (ValidationError, TypeError, KeyError) as exc:
                raise ServiceError('upstream_format', 'OpenDota вернул неполные данные. Повторите позже.') from exc
            return result
        return await self.cache.get_or_load(f'player:{player_id}', load)

    async def heroes(self):
        async def load():
            rows = await self.get('/heroStats')
            if not isinstance(rows, list):
                raise ServiceError('upstream_format', 'Справочник героев временно недоступен.')
            return [{'id': r['id'], 'name': r['localized_name'],
                     'image': 'https://cdn.cloudflare.steamstatic.com' + r['img']} for r in rows]
        return await self.cache.get_or_load('heroes', load)
