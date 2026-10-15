import re

from pydantic import ValidationError

from app.core.errors import ServiceError
from app.schemas.match import AdvantagePoint, MatchDetail, MatchPlayer


def match_id(raw: str) -> int:
    if not re.fullmatch(r'[0-9]{1,16}', raw) or not 1 <= int(raw) <= 9007199254740991:
        raise ServiceError('invalid_match_id', 'Введите положительный числовой ID матча.', 422)
    return int(raw)


def build_match(raw, expected_id: int, fetched_at: str) -> MatchDetail:
    try:
        if not isinstance(raw, dict) or type(raw.get('match_id')) is not int or raw['match_id'] != expected_id:
            raise ValueError('Mismatched match')
        rows = raw.get('players')
        if rows is None:
            rows = []
        if not isinstance(rows, list) or len(rows) > 10:
            raise ValueError('Invalid roster')
        players, slots = [], set()
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError('Invalid player')
            slot = row.get('player_slot')
            if type(slot) is not int or slot not in (*range(5), *range(128, 133)) or slot in slots:
                raise ValueError('Invalid or duplicate slot')
            slots.add(slot)
            fields = {key: row.get(key) for key in ('account_id', 'hero_id', 'kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min', 'hero_damage', 'tower_damage', 'hero_healing')}
            # OpenDota uses 0 as well as null for anonymous accounts.
            if fields['account_id'] == 0 and type(fields['account_id']) is int:
                fields['account_id'] = None
            players.append(MatchPlayer(**fields, player_slot=slot, side='radiant' if slot < 128 else 'dire',
                name=row.get('personaname') or row.get('name'), items=[row.get(f'item_{i}') for i in range(6)],
                backpack=[row.get(f'backpack_{i}') for i in range(3)], neutral_item=row.get('item_neutral')))
        notices = []
        version = raw.get('version')
        parsed = type(version) is int and version > 0
        if not parsed:
            notices.append('OpenDota не сообщает о завершённом разборе. Доступна базовая статистика; разбор не запускается автоматически.')
        if len(players) != 10:
            notices.append('Состав неполный: источник вернул не всех десятерых игроков.')
        result = MatchDetail(**{key: raw.get(key) for key in ('match_id', 'start_time', 'duration', 'radiant_win', 'radiant_score', 'dire_score', 'game_mode', 'lobby_type')},
            parsed=parsed, players=sorted(players, key=lambda p: p.player_slot), advantage=[], notices=notices,
            fetched_at=fetched_at, source_url=f'https://www.opendota.com/matches/{expected_id}')
        # The API documents advantage arrays as per-minute Radiant advantages.
        # Prefer actual player times when supplied. Never interpolate missing points.
        series = {}
        for key, field in [('gold', 'radiant_gold_adv'), ('xp', 'radiant_xp_adv')]:
            values = raw.get(field)
            if values is None or values == []:
                continue
            if (not isinstance(values, list) or len(values) > 10000
                    or any(type(v) is not int or abs(v) > 10**12 for v in values)):
                notices.append(f'Некорректный ряд {key} скрыт.')
                continue
            times = next((row.get('times') for row in rows if isinstance(row.get('times'), list) and len(row['times']) == len(values)), None)
            if times is None:
                times = [i * 60 for i in range(len(values))]
            if (any(type(t) is not int or t < 0 for t in times) or any(a >= b for a, b in zip(times, times[1:]))
                    or (result.duration is not None and times[-1] > result.duration + 60)):
                notices.append(f'Временная шкала {key} некорректна; ряд скрыт.')
                continue
            series[key] = dict(zip(times, values))
        result.advantage = [AdvantagePoint(seconds=t, gold=series.get('gold', {}).get(t), xp=series.get('xp', {}).get(t))
            for t in sorted(set().union(*(points.keys() for points in series.values())))]
        result.notices = notices
        # Validate assembled chart points too; no missing value is replaced by zero.
        return MatchDetail.model_validate(result.model_dump())
    except (ValidationError, ValueError, TypeError, KeyError) as exc:
        raise ServiceError('upstream_format', 'OpenDota вернул некорректные данные матча. Повторите позже.') from exc
