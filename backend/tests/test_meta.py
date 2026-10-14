import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ServiceError
from app.main import create_app
from app.services.meta import build_meta, build_patch_catalog, wilson
from app.services.opendota import OpenDota


def rows():
    return [dict(id=i, localized_name=f'Hero {i}', img=f'/apps/dota2/images/hero{i}.png',
                 primary_attr='agi', attack_type='Melee', roles=['Carry'],
                 pub_pick=1000, pub_win=550, pro_pick=40, pro_win=20, pro_ban=17,
                 turbo_picks=300, turbo_wins=180,
                 **{'1_pick': 100, '1_win': 40, '8_pick': 0, '8_win': 0}) for i in range(1, 11)]


def test_meta_percentages_sample_and_no_patch_claim():
    result = build_meta(rows(), '2026-10-14T00:00:00Z')
    assert result.total_picks == 10000
    assert result.heroes[0].winrate == 55
    assert result.heroes[0].pick_share == 10
    assert result.heroes[0].pickrate == 100
    assert result.available_brackets == ['1']
    assert 'не передаёт' in result.period


@pytest.mark.parametrize('mode,bracket,picks,rate', [('pub', '1', 100, 40), ('pro', 'all', 40, 50), ('turbo', 'all', 300, 60)])
def test_modes_and_brackets_do_not_mix(mode, bracket, picks, rate):
    hero = build_meta(rows(), 'now', mode, bracket).heroes[0]
    assert hero.picks == picks and hero.winrate == rate
    assert hero.bans == (17 if mode == 'pro' else None)


def test_zero_rank_does_not_fall_back_to_pub_stats():
    result = build_meta(rows(), 'now', bracket='8')
    assert result.total_picks == 0
    assert all(hero.winrate is None and hero.pickrate is None for hero in result.heroes)
    assert any('нет выборов' in notice for notice in result.notices)


def test_missing_counts_keep_unknown_and_disable_global_popularity():
    source = rows()
    source[0].pop('pub_pick')
    result = build_meta(source, 'now')
    assert not result.distribution_complete
    assert result.heroes[0].picks is None and result.heroes[0].winrate is None
    assert all(hero.pickrate is None and hero.pick_share is None for hero in result.heroes)
    assert result.heroes[1].winrate == 55


@pytest.mark.parametrize('change', [{'pub_win': 1001}, {'pub_pick': -1}, {'pub_win': True}, {'pub_pick': 1.5}, {'id': True}])
def test_malformed_statistics_fail_explicitly(change):
    source = rows()
    source[0].update(change)
    with pytest.raises(ServiceError) as exc:
        build_meta(source, 'now')
    assert exc.value.code == 'upstream_format'


def test_wilson_does_not_rank_tiny_perfect_sample_above_large_strong_sample():
    small = wilson(1, 1)
    large = wilson(600, 1000)
    assert small[0] < large[0] < 60 < large[1]
    assert wilson(0, 10)[0] == 0
    assert wilson(10, 10)[1] == 100


def test_duplicate_heroes_do_not_double_the_denominator():
    source = rows()
    source.append(source[0])
    with pytest.raises(ServiceError):
        build_meta(source, 'now')


def test_patch_reference_order_and_no_assumed_patch():
    result = build_patch_catalog([{'id': 1, 'name': '7.39', 'date': '2025-05-22T00:00:00Z'},
                                  {'id': 2, 'name': '7.40', 'date': '2025-12-16T00:00:00Z'}], 'now')
    assert result.patches[0].name == '7.40'
    assert 'не определяют' in result.notice
    with pytest.raises(ServiceError):
        build_patch_catalog([{'id': 1, 'name': '7.39', 'date': 'bad'}], 'now')


def test_catalog_and_meta_share_one_upstream_snapshot():
    calls = []
    async def scenario():
        def handler(request):
            calls.append(request)
            return httpx.Response(200, json=rows())
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = OpenDota(client, Settings())
            await service.heroes()
            first = await service.hero_stats_snapshot()
            second = await service.hero_stats_snapshot()
            assert first['fetched_at'] == second['fetched_at']
            assert len(calls) == 1
    asyncio.run(scenario())


def test_meta_api_validation_and_independent_patch_error():
    app = create_app(Settings(rate_limit_per_minute=100))
    class Source:
        async def hero_stats_snapshot(self):
            return {'rows': rows(), 'fetched_at': '2026-10-14T00:00:00Z'}
        async def patch_snapshot(self):
            raise ServiceError('upstream_unavailable', 'Unavailable', 503)
    with TestClient(app) as client:
        app.state.opendota = Source()
        assert client.get('/api/meta/heroes?mode=pub&bracket=1').json()['heroes'][0]['winrate'] == 40
        assert client.get('/api/meta/heroes?mode=pro&bracket=1').status_code == 422
        assert client.get('/api/meta/heroes?bracket=invalid').status_code == 422
        assert client.get('/api/meta/heroes?mode=unknown').status_code == 422
        assert client.get('/api/meta/patches').status_code == 503
        assert client.get('/api/meta/heroes').status_code == 200
