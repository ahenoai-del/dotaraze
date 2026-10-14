from fastapi import APIRouter, Request

from app.schemas.player import Dashboard
from app.services.identity import account_id

router = APIRouter(tags=['Public statistics'])


@router.get('/players/{steam_id}/dashboard', response_model=Dashboard)
async def dashboard(steam_id: str, request: Request):
    return await request.app.state.opendota.dashboard(account_id(steam_id))


@router.get('/heroes')
async def heroes(request: Request):
    return await request.app.state.opendota.heroes()
