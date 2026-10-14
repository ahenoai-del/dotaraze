import re

from app.core.errors import ServiceError

STEAM_BASE = 76561197960265728
MAX_ACCOUNT = 4294967295


def account_id(value: str) -> int:
    if not re.fullmatch(r'[0-9]{1,17}', value):
        raise ServiceError('invalid_id', 'Введите числовой Steam ID64 или Dota Friend ID.', 422)
    result = int(value)
    if result >= STEAM_BASE:
        result -= STEAM_BASE
    if not 1 <= result <= MAX_ACCOUNT:
        raise ServiceError('invalid_id', 'Steam ID находится вне допустимого диапазона.', 422)
    return result
