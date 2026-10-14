from math import sqrt

from app.core.errors import ServiceError
from app.schemas.meta import MetaHero, MetaSnapshot, PatchCatalog, PatchReference


def count(value):
    if value is None:
        return None
    if type(value) is not int or not 0 <= value <= 10**12:
        raise ValueError('Invalid upstream count')
    return value


def wilson(wins: int, picks: int) -> tuple[float, float]:
    """95% Wilson interval for a binomial proportion, descriptive (not a forecast)."""
    z = 1.959963984540054
    p = wins / picks
    denominator = 1 + z * z / picks
    middle = (p + z * z / (2 * picks)) / denominator
    radius = z * sqrt((p * (1 - p) + z * z / (4 * picks)) / picks) / denominator
    return round(max(0, middle - radius) * 100, 4), round(min(1, middle + radius) * 100, 4)


def counts_for(row, mode, bracket):
    if mode == 'pub':
        prefix = 'pub' if bracket == 'all' else bracket
        pick_key, win_key = f'{prefix}_pick', f'{prefix}_win'
    elif mode == 'pro':
        pick_key, win_key = 'pro_pick', 'pro_win'
    else:
        pick_key, win_key = 'turbo_picks', 'turbo_wins'
    picks, wins = count(row.get(pick_key)), count(row.get(win_key))
    if wins is not None and picks is not None and wins > picks:
        raise ValueError('Wins exceed picks')
    return picks, wins


def build_meta(rows: list[dict], fetched_at: str, mode='pub', bracket='all') -> MetaSnapshot:
    if mode != 'pub' and bracket != 'all':
        raise ServiceError('invalid_filter', 'Ранговые срезы доступны только для пабликов.', 422)
    try:
        counts = [counts_for(row, mode, bracket) for row in rows]
        complete = bool(rows) and all(picks is not None for picks, _ in counts)
        total = sum(picks for picks, _ in counts if picks is not None)
        heroes = []
        seen = set()
        for row, (picks, wins) in zip(rows, counts):
            hero_id = row['id']
            if type(hero_id) is not int or hero_id <= 0 or hero_id in seen:
                raise ValueError('Invalid or duplicate hero ID')
            seen.add(hero_id)
            name = row['localized_name']
            roles = row.get('roles', [])
            if not isinstance(name, str) or not name or not isinstance(roles, list) or not all(isinstance(r, str) for r in roles):
                raise ValueError('Invalid hero metadata')
            low, high = wilson(wins, picks) if picks and wins is not None else (None, None)
            share = picks / total * 100 if complete and total and picks is not None else None
            # Do not publish impossible percentages when a source distribution is incomplete.
            popularity = share * 10 if share is not None and share <= 10 else None
            image = row.get('img')
            heroes.append(MetaHero(
                id=hero_id, name=name, image='https://cdn.cloudflare.steamstatic.com' + image if isinstance(image, str) and image.startswith('/apps/dota2/') else None,
                primary_attr=row.get('primary_attr'), attack_type=row.get('attack_type'), roles=roles,
                picks=picks, wins=wins, winrate=round(wins / picks * 100, 4) if picks and wins is not None else None,
                pick_share=round(share, 4) if share is not None else None,
                pickrate=round(popularity, 4) if popularity is not None else None,
                confidence_low=low, confidence_high=high, bans=count(row.get('pro_ban')) if mode == 'pro' else None,
            ))
        available = [str(i) for i in range(1, 9) if any(type(row.get(f'{i}_pick')) is int and row[f'{i}_pick'] > 0 for row in rows)]
    except (ValueError, TypeError, KeyError) as exc:
        raise ServiceError('upstream_format', 'Статистика меты OpenDota содержит некорректные данные. Попробуйте позже.') from exc
    notices = [
        'Теги Carry/Support и другие описывают героя, а не позицию в конкретном матче.',
        'Pickrate — оценка популярности из 10 игровых слотов; точная доля выборов также показана в деталях.',
    ]
    if not complete:
        notices.append('Не для всех героев доступны счётчики выборов. Общая выборка частичная; Pickrate не рассчитывается.')
    if not total:
        notices.append('Для этого среза сейчас нет выборов. Нули не заменяются статистикой другого ранга или режима.')
    return MetaSnapshot(mode=mode, bracket=bracket, heroes=heroes, total_picks=total, distribution_complete=complete,
                        available_brackets=available, fetched_at=fetched_at, notices=notices)


def build_patch_catalog(rows, fetched_at):
    try:
        patches = [PatchReference.model_validate(row) for row in rows]
        # Only valid ISO timestamps are used for ordering; malformed sources fail explicitly.
        from datetime import datetime
        patches.sort(key=lambda p: datetime.fromisoformat(p.date.replace('Z', '+00:00')), reverse=True)
    except (ValueError, TypeError, KeyError) as exc:
        raise ServiceError('upstream_format', 'Справочник патчей OpenDota временно недоступен.') from exc
    return PatchCatalog(patches=patches[:8], fetched_at=fetched_at)
