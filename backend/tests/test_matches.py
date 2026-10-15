import asyncio
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import ServiceError
from app.main import create_app
from app.services.matches import build_match, match_id
from app.services.opendota import OpenDota


def source():
    return dict(match_id=123, duration=120, start_time=1700000000, radiant_win=False, version=22,
                radiant_gold_adv=[0, -120, 40], radiant_xp_adv=[10, -20, 30],
                players=[dict(player_slot=0, hero_id=1, account_id=0, kills=0, hero_healing=0, item_0=0, times=[0, 60, 120]),
                         dict(player_slot=128, hero_id=2, account_id=456, personaname='Test', kills=4)])


def test_full_metrics_preserve_zeros_unknowns_sides_items_and_sign():
    data = build_match(source(), 123, 'now')
    assert data.radiant_win is False and data.parsed
    assert data.players[0].side == 'radiant' and data.players[1].side == 'dire'
    assert data.players[0].account_id is None
    assert data.players[0].kills == data.players[0].hero_healing == 0
    assert data.players[0].deaths is None
    assert data.players[0].items == [0, None, None, None, None, None]
    assert data.advantage[1].gold == -120 and data.advantage[1].seconds == 60


def test_unparsed_and_missing_players_do_not_invent_result_or_series():
    data = build_match({'match_id': 123}, 123, 'now')
    assert not data.parsed and data.radiant_win is None and data.duration is None
    assert data.advantage == data.players == [] and len(data.notices) == 2


@pytest.mark.parametrize('change', [dict(match_id=124), dict(radiant_win=1), dict(duration=-1), dict(players=[None]),
    dict(players=[dict(player_slot=True)]), dict(players=[dict(player_slot=5)]),
    dict(players=[dict(player_slot=0, kills=True)]), dict(players=[dict(player_slot=0), dict(player_slot=0)])])
def test_bad_identity_roster_and_metrics_return_controlled_error(change):
    with pytest.raises(ServiceError) as exc:
        build_match(source() | change, 123, 'now')
    assert exc.value.code == 'upstream_format'


def test_chart_missing_and_invalid_series_are_independent():
    raw = source() | dict(radiant_gold_adv=[0, True, 1], radiant_xp_adv=[1, 2])
    data = build_match(raw, 123, 'now')
    assert [point.gold for point in data.advantage] == [None, None]
    assert [point.xp for point in data.advantage] == [1, 2]
    assert any('скрыт' in notice for notice in data.notices)
    raw = deepcopy(source())
    raw['players'][0]['times'] = [0, 60, 60]
    assert not build_match(raw, 123, 'now').advantage


@pytest.mark.parametrize('raw', ['0', '-1', 'abc', '１２３', '9007199254740992', '1/2'])
def test_invalid_ids(raw):
    with pytest.raises(ServiceError) as exc:
        match_id(raw)
    assert exc.value.status == 422


def test_valid_ids():
    assert match_id('123') == 123
    assert match_id('9007199254740991') == 9007199254740991


@pytest.mark.parametrize('status,code', [(404, 'match_unavailable'), (429, 'upstream_limit'), (500, 'upstream_unavailable')])
def test_match_upstream_errors(status, code):
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status))) as client:
            with pytest.raises(ServiceError) as exc:
                await OpenDota(client, Settings()).match(123)
            assert exc.value.code == code
    asyncio.run(scenario())


def test_route_cache_and_validation_before_network():
    calls = []
    app = create_app(Settings(rate_limit_per_minute=100))
    with TestClient(app) as client:
        async def get(path, params=None):
            calls.append(path)
            return source()
        app.state.opendota.get = get
        assert client.get('/api/matches/0').status_code == 422
        assert client.get('/api/matches/no').status_code == 422
        assert calls == []
        assert client.get('/api/matches/123').json()['players'][0]['kills'] == 0
        assert client.get('/api/matches/123').status_code == 200
        assert calls == ['/matches/123']
