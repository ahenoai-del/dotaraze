from fastapi import APIRouter, Request

from app.schemas.meta import MetaBracket, MetaMode, MetaSnapshot, PatchCatalog
from app.services.meta import build_meta, build_patch_catalog

router = APIRouter(prefix='/meta', tags=['Meta Lab'])


@router.get('/heroes', response_model=MetaSnapshot)
async def heroes(request: Request, mode: MetaMode = 'pub', bracket: MetaBracket = 'all'):
    # Validate combinations before touching the upstream service.
    if mode != 'pub' and bracket != 'all':
        from app.core.errors import ServiceError
        raise ServiceError('invalid_filter', 'Ранговые срезы доступны только для пабликов.', 422)
    snapshot = await request.app.state.opendota.hero_stats_snapshot()
    return build_meta(snapshot['rows'], snapshot['fetched_at'], mode, bracket)


@router.get('/patches', response_model=PatchCatalog)
async def patches(request: Request):
    snapshot = await request.app.state.opendota.patch_snapshot()
    return build_patch_catalog(snapshot['rows'], snapshot['fetched_at'])
