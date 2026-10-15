import asyncio
from datetime import datetime, timezone

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.limits import ResponseCache
from app.schemas.player import Dashboard, Profile
from app.services.statistics import hero_statistics, normalize_match, summarize
from app.services.matches import build_match


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
            except (httpx.TransportError, httpx.HTTPStatusError, ValueError) as exc:
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
                if len({match.match_id for match in matches}) != len(matches):
                    raise ValueError('Duplicate upstream matches')
                matches = sorted(matches, key=lambda match: match.start_time, reverse=True)[:100]
                result = Dashboard(
                    profile=Profile(account_id=player_id, name=profile['profile'].get('personaname') or f'Игрок {player_id}',
                                    avatar=profile['profile'].get('avatarfull'), rank_tier=profile.get('rank_tier')),
                    matches=matches, summary=summarize(matches), heroes=hero_statistics(matches),
                    fetched_at=datetime.now(timezone.utc).isoformat(),
                    notice='Нет доступных матчей. История может быть скрыта или ещё не собрана OpenDota.' if not matches else None,
                )
            except (ValidationError, ValueError, TypeError, KeyError) as exc:
                raise ServiceError('upstream_format', 'OpenDota вернул неполные данные. Повторите позже.') from exc
            return result
        return await self.cache.get_or_load(f'player:{player_id}', load)

    async def match(self, match_id: int):
        async def load():
            try:
                raw = await self.get(f'/matches/{match_id}')
            except ServiceError as exc:
                if exc.code == 'profile_unavailable':
                    raise ServiceError('match_unavailable', 'Матч не найден или недоступен в OpenDota.', 404) from exc
                raise
            if raw is None or isinstance(raw, dict) and raw.get('error'):
                raise ServiceError('match_unavailable', 'Матч не найден или недоступен в OpenDota.', 404)
            return build_match(raw, match_id, datetime.now(timezone.utc).isoformat())
        return await self.cache.get_or_load(f'match:{match_id}', load)

    async def items(self):
        async def load():
            rows = await self.get('/constants/items')
            if not isinstance(rows, dict):
                raise ServiceError('upstream_format', 'Справочник предметов недоступен.')
            return [{'id': row['id'], 'name': row.get('dname') or name,
                     'image': 'https://cdn.cloudflare.steamstatic.com' + row['img'] if isinstance(row.get('img'), str) and row['img'].startswith('/apps/dota2/') else None}
                    for name, row in rows.items() if isinstance(row, dict) and type(row.get('id')) is int and row['id'] > 0]
        return await self.cache.get_or_load('items', load)

    async def heroes(self):
        snapshot = await self.hero_stats_snapshot()
        try:
            for row in snapshot['rows']:
                if (type(row.get('id')) is not int or row['id'] <= 0
                        or not isinstance(row.get('localized_name'), str) or not row['localized_name']
                        or not isinstance(row.get('img'), str) or not row['img'].startswith('/apps/dota2/')):
                    raise ValueError('Invalid hero metadata')
            if len({row['id'] for row in snapshot['rows']}) != len(snapshot['rows']):
                raise ValueError('Duplicate hero IDs')
            return [{'id': r['id'], 'name': r['localized_name'],
                     'image': 'https://cdn.cloudflare.steamstatic.com' + r['img']} for r in snapshot['rows']]
        except (KeyError, TypeError, ValueError) as exc:
            raise ServiceError('upstream_format', 'Справочник героев временно недоступен.') from exc

    async def hero_stats_snapshot(self):
        async def load():
            rows = await self.get('/heroStats')
            if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
                raise ServiceError('upstream_format', 'Справочник героев временно недоступен.')
            return {'rows': rows, 'fetched_at': datetime.now(timezone.utc).isoformat()}
        return await self.cache.get_or_load('hero_stats', load)

    async def patch_snapshot(self):
        async def load():
            rows = await self.get('/constants/patch')
            if not isinstance(rows, list):
                raise ServiceError('upstream_format', 'Справочник патчей временно недоступен.')
            return {'rows': rows, 'fetched_at': datetime.now(timezone.utc).isoformat()}
        return await self.cache.get_or_load('patches', load)
