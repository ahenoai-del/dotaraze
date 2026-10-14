from collections import defaultdict
from statistics import mean

from app.schemas.player import HeroSummary, Match, Summary


def normalize_match(row: dict) -> Match:
    slot, victory = row.get('player_slot'), row.get('radiant_win')
    won = (slot < 128) == victory if isinstance(slot, int) and isinstance(victory, bool) else None
    return Match(**{key: row.get(key) for key in Match.model_fields if key != 'won'}, won=won)


def summarize(matches: list[Match]) -> Summary:
    decided = [m for m in matches if m.won is not None]
    combat = [m for m in matches if all(v is not None for v in (m.kills, m.deaths, m.assists))]
    gold = [m.gold_per_min for m in matches if m.gold_per_min is not None]
    xp = [m.xp_per_min for m in matches if m.xp_per_min is not None]
    wins = sum(m.won is True for m in decided)
    return Summary(
        matches=len(matches), decided_matches=len(decided), wins=wins,
        winrate=round(wins / len(decided) * 100, 2) if decided else None,
        kda=round(mean((m.kills + m.assists) / max(1, m.deaths) for m in combat), 2) if combat else None,
        gpm=round(mean(gold), 1) if gold else None, xpm=round(mean(xp), 1) if xp else None,
        kda_samples=len(combat), gpm_samples=len(gold), xpm_samples=len(xp),
    )


def hero_statistics(matches: list[Match]) -> list[HeroSummary]:
    groups = defaultdict(list)
    for match in matches:
        groups[match.hero_id].append(match)
    result = []
    for hero, rows in groups.items():
        summary = summarize(rows)
        result.append(HeroSummary(hero_id=hero, games=len(rows), wins=summary.wins,
                                  decided_matches=summary.decided_matches, winrate=summary.winrate))
    return sorted(result, key=lambda h: (-h.games, h.hero_id))
