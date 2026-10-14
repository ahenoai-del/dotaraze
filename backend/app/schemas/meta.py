from typing import Literal

from pydantic import BaseModel

MetaMode = Literal['pub', 'pro', 'turbo']
MetaBracket = Literal['all', '1', '2', '3', '4', '5', '6', '7', '8']


class MetaHero(BaseModel):
    id: int
    name: str
    image: str | None
    primary_attr: str | None
    attack_type: str | None
    roles: list[str]
    picks: int | None
    wins: int | None
    winrate: float | None
    pick_share: float | None
    pickrate: float | None
    confidence_low: float | None
    confidence_high: float | None
    bans: int | None = None


class MetaSnapshot(BaseModel):
    mode: MetaMode
    bracket: MetaBracket
    heroes: list[MetaHero]
    total_picks: int
    distribution_complete: bool
    available_brackets: list[str]
    fetched_at: str
    source: str = 'OpenDota /heroStats'
    source_url: str = 'https://docs.opendota.com/'
    period: str = 'Границы периода и патч выборки источник не передаёт.'
    pickrate_method: str = 'Оценка: выборы героя / все выборы × 10 × 100%. Не доля уникальных матчей, особенно в срезах по рангу.'
    notices: list[str]


class PatchReference(BaseModel):
    id: int
    name: str
    date: str


class PatchCatalog(BaseModel):
    patches: list[PatchReference]
    fetched_at: str
    source: str = 'OpenDota /constants/patch'
    notice: str = 'Справочник версий может отставать. Эти патчи не определяют период статистики heroStats.'
