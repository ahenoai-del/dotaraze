from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class SPAStaticFiles(StaticFiles):
    """Optional built frontend, with SPA fallback only for document navigations."""

    async def get_response(self, path, scope):
        # StaticFiles normalizes using the host OS, including backslashes on Windows.
        path = path.replace('\\', '/')
        # Never turn API mistakes or missing assets into a successful HTML response.
        if path == 'api' or path.startswith('api/') or any(part.startswith('.') for part in PurePosixPath(path).parts):
            raise HTTPException(404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            headers = dict(scope.get('headers', []))
            if (exc.status_code != 404 or scope['method'] not in ('GET', 'HEAD')
                    or PurePosixPath(path).suffix or '..' in PurePosixPath(path).parts
                    or 'text/html' not in headers.get(b'accept', b'').decode('latin-1')):
                raise
            response = await super().get_response('index.html', scope)
        response.headers['Cache-Control'] = (
            'public, max-age=31536000, immutable' if path.startswith('assets/') and response.status_code == 200
            else 'no-cache'
        )
        return response
