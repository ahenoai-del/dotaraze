import asyncio

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import ServiceError
from app.core.limits import RateLimiter, ResponseCache
from app.services.opendota import OpenDota


def run(coro):
    return asyncio.run(coro)


def test_upstream_request_projection_cache_and_missing_metrics():
    calls = []
    def handler(request):
        calls.append(request)
        if request.url.path.endswith('/matches'):
            assert request.url.params.get_list('project') == ['hero_id', 'start_time', 'kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min']
            return httpx.Response(200, json=[dict(match_id=1, hero_id=2, start_time=100, duration=60,
                                                  player_slot=128, radiant_win=False, kills=1, deaths=0, assists=2)])
        return httpx.Response(200, json={'profile': {'personaname': 'Test'}})
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = OpenDota(client, Settings())
            data = await service.dashboard(1)
            assert data.summary.winrate == 100
            assert data.summary.gpm is None
            assert data.summary.gpm_samples == 0
            assert await service.dashboard(1) is data
            assert len(calls) == 2
    run(scenario())


@pytest.mark.parametrize('status,code', [(429, 'upstream_limit'), (403, 'profile_unavailable'), (404, 'profile_unavailable'), (500, 'upstream_unavailable')])
def test_upstream_failures_are_explicit(status, code):
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status))) as client:
            with pytest.raises(ServiceError) as exc:
                await OpenDota(client, Settings()).dashboard(1)
            assert exc.value.code == code
    run(scenario())


def test_private_or_unknown_profile_is_not_fabricated():
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'profile': None}))) as client:
            with pytest.raises(ServiceError) as exc:
                await OpenDota(client, Settings()).dashboard(1)
            assert exc.value.status == 404
    run(scenario())


def test_empty_history_keeps_unknown_metrics():
    async def scenario():
        transport = httpx.MockTransport(lambda r: httpx.Response(200, json=[] if r.url.path.endswith('matches') else {'profile': {'personaname': 'T'}}))
        async with httpx.AsyncClient(transport=transport) as client:
            data = await OpenDota(client, Settings()).dashboard(1)
            assert data.matches == [] and data.notice
            assert data.summary.winrate is None
    run(scenario())


def test_timeout_retries_are_bounded():
    calls = []
    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout('timeout')
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises(ServiceError):
                await OpenDota(client, Settings()).dashboard(1)
            assert len(calls) == 3
    run(scenario())


def test_cache_expires_and_is_bounded():
    async def scenario():
        cache = ResponseCache(0, 2)
        values = []
        async def load():
            values.append(1)
            return len(values)
        assert await cache.get_or_load('a', load) == 1
        assert await cache.get_or_load('a', load) == 2
        await cache.get_or_load('b', load)
        await cache.get_or_load('c', load)
        assert len(cache.entries) == 2
    run(scenario())


def test_rate_limit():
    limiter = RateLimiter(2)
    assert limiter.allow('a') and limiter.allow('a')
    assert not limiter.allow('a')
    assert limiter.allow('b')
