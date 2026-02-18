# STT — Simple Time Tracking

STT is a mobile-first time tracking **PWA** (Progressive Web App) for tracking work time and breaks.

It is built as a small, self-hostable stack:

- **Backend**: FastAPI + SQLAlchemy + SQLite (+ Alembic migrations)
- **Frontend**: Vite + React + `vite-plugin-pwa`

## Features

- **Clock events**: COME / GO / BREAK_START / BREAK_END
- **Dashboard**: live status (OFF/WORKING/BREAK), worked/break totals, remaining targets
- **History**: recent entries (default: last 7 days) with edit/delete
- **Reports**: weekly and monthly reports with navigation (jump/prev/next)
- **Absences**: CRUD absences and absence reasons
- **Notes**: day notes visible in the monthly heatmap
- **Multi-language UI**: English + German
- **Offline-friendly**: PWA installable
- **(Optional) Web Push notifications**: per-user thresholds for work/break minutes

## Repo layout

- `apps/api`: FastAPI backend
- `apps/web`: Vite + React frontend

## Requirements

- Python **3.11+** (backend)
- Node.js **18+** (frontend)
- `uv` for Python dependency management

## Run locally

### 1) Backend (API)

```bash
cd apps/api

# create/update local sqlite db
uv run alembic upgrade head

# start API
uv run uvicorn app.main:app --reload
```

The API will run on `http://localhost:8000`.

#### Backend config

Copy and edit `apps/api/.env.example` → `apps/api/.env`.

Important variables:

- `TT_BASE_URL` (frontend origin for CORS, e.g. `http://localhost:5173`)
- `TT_SQLITE_PATH` (SQLite file path, default `./data/app.db`)
- `TT_JWT_SECRET_KEY` (change in production)

### 2) Frontend (Web)

```bash
cd apps/web
npm install

# configure API base url
cp .env.example .env

npm run dev
```

The frontend will run on `http://localhost:5173`.

#### Frontend config

`apps/web/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Push notifications (optional)

STT supports real **Web Push** notifications (delivered even when the PWA is closed) with per-user threshold lists:

- “Work thresholds (minutes)” → e.g. `30, 60, 120`
- “Break thresholds (minutes)” → e.g. `10, 20, 30`

When a threshold is reached, the backend worker sends a push message like:

- “You have worked X minutes so far.”
- “You have taken X minutes break so far.”

### 1) Configure VAPID keys

Generate VAPID keys (example using `py-vapid`):

```bash
cd apps/api
uv run python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key); print(v.private_key)"
```

Add them to `apps/api/.env`:

```env
TT_VAPID_PUBLIC_KEY=...
TT_VAPID_PRIVATE_KEY=...
TT_VAPID_SUBJECT=mailto:admin@example.com
```

### 2) Run the push worker

The push sender runs as a separate process:

```bash
cd apps/api
uv run python -m app.push_worker
```

### 3) Enable in the UI

Open **Settings → Push notifications** and click **Enable push**.

Note:

- Web Push typically requires **HTTPS** (or `localhost`).
- iOS Safari has limitations; Chrome/Edge on desktop works best for testing.

## More docs

- Backend: `apps/api/README.md`
- Frontend: `apps/web/README.md`

## Run with Docker (recommended)

This repository includes a `docker-compose.yml` that starts:

- `web` (nginx serving the built PWA)
- `api` (FastAPI backend)
- `push-worker` (**optional**, sends Web Push notifications)

### 1) Configure environment variables

Copy the example file and adjust values as needed:

```bash
cp .env.docker.example .env
```

Notes:

- All backend settings that are normally read from `apps/api/.env` can be supplied via **Docker environment variables**.
- SQLite is stored in a named Docker volume (`stt-data`).

### 2) Start

```bash
docker compose up --build
```

Then open:

- Web UI: http://localhost:5173
- API: http://localhost:8000

### 3) Push notifications

To enable Web Push, set the VAPID variables in `.env` (docker compose env file):

```env
TT_VAPID_PUBLIC_KEY=...
TT_VAPID_PRIVATE_KEY=...
TT_VAPID_SUBJECT=mailto:admin@example.com
```

Then start the optional worker profile:

```bash
docker compose --profile push up --build
```

The `push-worker` service uses the same env vars and the same SQLite database volume.
