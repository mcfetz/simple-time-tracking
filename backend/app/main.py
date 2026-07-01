from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.settings import settings

from app.routers.absences import router as absences_router
from app.routers.auth import router as auth_router
from app.routers.clock import router as clock_router
from app.routers.dashboard import router as dashboard_router
from app.routers.notes import router as notes_router
from app.routers.push import router as push_router
from app.routers.reports import router as reports_router
from app.routers.settings import router as settings_router


NO_STORE_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
NO_CACHE_HEADERS = {"Cache-Control": "no-cache, must-revalidate"}
IMMUTABLE_ASSET_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}
SW_RELATED_FILENAMES = {"sw.js", "registerSW.js", "manifest.webmanifest"}


def _safe_frontend_file(frontend_root: Path, requested_path: str) -> Path | None:
    normalized = requested_path.lstrip('/')
    candidate = (frontend_root / normalized).resolve()
    if candidate == frontend_root or frontend_root in candidate.parents:
        return candidate if candidate.is_file() else None
    return None


def _headers_for_frontend_file(frontend_root: Path, file_path: Path) -> dict[str, str]:
    if file_path.name in SW_RELATED_FILENAMES:
        return NO_CACHE_HEADERS

    try:
        relative = file_path.relative_to(frontend_root)
    except ValueError:
        return {}

    if relative.parts and relative.parts[0] == 'assets':
        return IMMUTABLE_ASSET_HEADERS

    return {}


def create_app() -> FastAPI:
    app = FastAPI(title="STT - Simple Time Tracking API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.base_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router, prefix="/api")
    app.include_router(clock_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(settings_router, prefix="/api")
    app.include_router(reports_router, prefix="/api")
    app.include_router(absences_router, prefix="/api")
    app.include_router(notes_router, prefix="/api")
    app.include_router(push_router, prefix="/api")

    if settings.frontend_dir and os.path.isdir(settings.frontend_dir):
        frontend_root = Path(settings.frontend_dir).resolve()
        index_file = frontend_root / 'index.html'

        @app.get('/{full_path:path}')
        async def serve_spa(full_path: str, request: Request):
            if full_path.startswith('api/') or full_path == 'health':
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Not Found')

            if full_path:
                requested_file = _safe_frontend_file(frontend_root, full_path)
                if requested_file is not None:
                    return FileResponse(requested_file, headers=_headers_for_frontend_file(frontend_root, requested_file))

            if index_file.exists():
                return FileResponse(index_file, headers=NO_STORE_HEADERS)

            return {"detail": "Frontend not found"}

    return app


app = create_app()
