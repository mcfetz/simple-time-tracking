from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import settings

from app.routers.auth import router as auth_router
from app.routers.clock import router as clock_router
from app.routers.dashboard import router as dashboard_router
from app.routers.settings import router as settings_router
from app.routers.reports import router as reports_router
from app.routers.absences import router as absences_router
from app.routers.notes import router as notes_router


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

    app.include_router(auth_router)
    app.include_router(clock_router)
    app.include_router(dashboard_router)
    app.include_router(settings_router)
    app.include_router(reports_router)
    app.include_router(absences_router)
    app.include_router(notes_router)

    return app


app = create_app()
