# Time Tracking PWA (FastAPI + SQLite + Vite)

Multi-user progressive web app for tracking work time (COME/GO/BREAK_START/BREAK_END) with per-user targets and weekly/monthly reporting.

## Repo layout

- `apps/api`: FastAPI backend (SQLite + SQLAlchemy)
- `apps/web`: Vite PWA frontend
- `infra`: optional docker/dev scripts
- `docs`: specs/notes

## Local dev (planned)

Backend:
- `cd apps/api`
- `uv run uvicorn app.main:app --reload`

Frontend:
- `cd apps/web`
- `npm install`
- `npm run dev`
