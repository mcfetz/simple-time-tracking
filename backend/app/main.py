from __future__ import annotations
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.settings import settings

from app.routers.auth import router as auth_router
from app.routers.clock import router as clock_router
from app.routers.dashboard import router as dashboard_router
from app.routers.settings import router as settings_router
from app.routers.reports import router as reports_router
from app.routers.absences import router as absences_router
from app.routers.notes import router as notes_router
from app.routers.push import router as push_router


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
        app.mount(
            "/assets",
            StaticFiles(directory=os.path.join(settings.frontend_dir, "assets")),
            name="assets",
        )

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str, request: Request):
            if full_path.startswith("api/") or full_path == "health":
                return {"detail": "Not Found"}
            index_file = os.path.join(settings.frontend_dir, "index.html")
            if os.path.exists(index_file):
                return FileResponse(index_file)
            return {"detail": "Frontend not found"}

    return app


app = create_app()
