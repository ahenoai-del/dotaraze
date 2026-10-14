from typing import Annotated

from pydantic import BaseModel, Field

NonNegative = Annotated[int, Field(strict=True, ge=0)]


class Profile(BaseModel):
    account_id: int
    name: str
    avatar: str | None = None
    rank_tier: int | None = None


class Match(BaseModel):
    match_id: Annotated[int, Field(strict=True, gt=0)]
    hero_id: NonNegative
    start_time: Annotated[int, Field(strict=True, ge=0, le=253402300799)]
    duration: NonNegative
    won: bool | None
    kills: NonNegative | None = None
    deaths: NonNegative | None = None
    assists: NonNegative | None = None
    gold_per_min: NonNegative | None = None
    xp_per_min: NonNegative | None = None
    lobby_type: NonNegative | None = None


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
