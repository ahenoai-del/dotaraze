from typing import Annotated, Literal

from pydantic import BaseModel, Field

Count = Annotated[int, Field(strict=True, ge=0, le=10**12)]
Identifier = Annotated[int, Field(strict=True, gt=0, le=9007199254740991)]


class MatchPlayer(BaseModel):
    player_slot: Annotated[int, Field(strict=True)]
    side: Literal['radiant', 'dire']
    account_id: Annotated[int, Field(strict=True, ge=1, le=4294967295)] | None = None
    name: str | None = None
    hero_id: Count | None = None
    kills: Count | None = None
    deaths: Count | None = None
    assists: Count | None = None
    gold_per_min: Count | None = None
    xp_per_min: Count | None = None
    hero_damage: Count | None = None
    tower_damage: Count | None = None
    hero_healing: Count | None = None
    items: list[Count | None]
    backpack: list[Count | None]
    neutral_item: Count | None = None


class AdvantagePoint(BaseModel):
    seconds: int
    gold: int | None
    xp: int | None


class MatchDetail(BaseModel):
    match_id: Identifier
    start_time: Annotated[int, Field(strict=True, ge=0, le=253402300799)] | None = None
    duration: Count | None = None
    radiant_win: Annotated[bool, Field(strict=True)] | None = None
    radiant_score: Count | None = None
    dire_score: Count | None = None
    game_mode: Count | None = None
    lobby_type: Count | None = None
    parsed: bool
    players: list[MatchPlayer]
    advantage: list[AdvantagePoint]
    notices: list[str]
    fetched_at: str
    source: str = 'OpenDota'
    source_url: str
