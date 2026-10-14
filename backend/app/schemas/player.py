from pydantic import BaseModel


class Profile(BaseModel):
    account_id: int
    name: str
    avatar: str | None = None
    rank_tier: int | None = None


class Match(BaseModel):
    match_id: int
    hero_id: int
    start_time: int
    duration: int
    won: bool | None
    kills: int | None = None
    deaths: int | None = None
    assists: int | None = None
    gold_per_min: int | None = None
    xp_per_min: int | None = None
    lobby_type: int | None = None


class Summary(BaseModel):
    matches: int
    decided_matches: int
    wins: int
    winrate: float | None
    kda: float | None
    gpm: float | None
    xpm: float | None
    kda_samples: int
    gpm_samples: int
    xpm_samples: int


class HeroSummary(BaseModel):
    hero_id: int
    games: int
    wins: int
    decided_matches: int
    winrate: float | None


class Dashboard(BaseModel):
    profile: Profile
    summary: Summary
    heroes: list[HeroSummary]
    matches: list[Match]
    source: str = 'OpenDota'
    fetched_at: str
    sample_limit: int = 100
    notice: str | None = None
