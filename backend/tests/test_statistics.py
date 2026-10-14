import pytest

from app.core.errors import ServiceError
from app.services.identity import STEAM_BASE, account_id
from app.services.statistics import hero_statistics, normalize_match, summarize


def match(**overrides):
    return normalize_match(dict(match_id=1, hero_id=1, start_time=1700000000, duration=2000,
                                player_slot=0, radiant_win=True, kills=10, deaths=0, assists=5,
                                gold_per_min=0, xp_per_min=500, lobby_type=7) | overrides)


@pytest.mark.parametrize('slot,radiant,won', [(0, True, True), (4, False, False), (128, False, True), (132, True, False)])
def test_side_determines_result(slot, radiant, won):
    assert match(player_slot=slot, radiant_win=radiant).won is won


def test_unknown_result_is_not_a_loss():
    stats = summarize([match(radiant_win=None), match()])
    assert stats.decided_matches == 1
    assert stats.winrate == 100


@pytest.mark.parametrize('slot', [True, -1, 5, 127, 133, 256, '0', None])
def test_invalid_or_spectator_slots_have_unknown_result(slot):
    assert match(player_slot=slot).won is None


def test_zero_deaths_missing_metrics_and_real_zero():
    stats = summarize([match(), match(match_id=2, kills=2, deaths=2, assists=4, gold_per_min=None, xp_per_min=None)])
    assert stats.kda == 9  # mean(15 / max(1, 0), 6 / 2)
    assert stats.gpm == 0
    assert stats.xpm == 500
    assert stats.gpm_samples == 1


def test_empty_and_incomplete_samples_are_null():
    assert summarize([]).winrate is None
    assert summarize([]).kda is None
    assert summarize([match(kills=None)]).kda is None
    assert summarize([match(gold_per_min=None)]).gpm is None


def test_hero_groups_use_the_same_sample():
    rows = hero_statistics([match(), match(match_id=2, radiant_win=False), match(match_id=3, hero_id=2)])
    assert rows[0].hero_id == 1 and rows[0].games == 2 and rows[0].winrate == 50
    assert rows[1].games == 1


@pytest.mark.parametrize('raw,expected', [('1', 1), ('4294967295', 4294967295), (str(STEAM_BASE + 123), 123)])
def test_valid_identifiers(raw, expected):
    assert account_id(raw) == expected


@pytest.mark.parametrize('raw', ['0', '-1', 'abc', '1;DROP TABLE accounts', '4294967296', str(STEAM_BASE), '７７', 'https://steamcommunity.com/id/test'])
def test_invalid_identifiers(raw):
    with pytest.raises(ServiceError):
        account_id(raw)
