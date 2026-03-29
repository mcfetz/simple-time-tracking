# STT API (FastAPI + SQLite)

## Local dev

```bash
cd backend
uv run uvicorn app.main:app --reload
```

## Web Push (optional)

This project supports Web Push notifications (PWA) via VAPID.

### 1) Generate VAPID keys

Example using `py-vapid`:

```bash
cd backend
uv run python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key); print(v.private_key)"
```

### 2) Configure env

Put them into `backend/.env`:

```env
TT_VAPID_PUBLIC_KEY=...
TT_VAPID_PRIVATE_KEY=...
TT_VAPID_SUBJECT=mailto:admin@example.com
```

### 3) Run worker

Run the push worker as a separate process:

```bash
cd backend
uv run python -m app.push_worker
```
