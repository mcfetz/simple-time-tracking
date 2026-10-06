# simple-time-tracking — Development Guidelines

## Project
- PWA time tracker. Frontend React 19 / Vite / TypeScript 6 in `frontend/`, API FastAPI / SQLAlchemy / uv in `backend/`.
- Two remotes — **always push to both**: `origin` (git.familie-heise.de) and `github` (github.com/mcfetz).
- Commits use the Conventional Commits style. No code comments unless explicitly requested.

## Quality assurance (mandatory before any work item is closed)
Backend (`backend/`):
- `uv run ruff check .` → 0 findings
- `uv run ruff format --check .` → 0 changes needed
- `uv run ty check .` → 0 errors

Frontend (`frontend/`):
- `npm run lint` → 0 errors
- `npm run build` → green (incl. Workbox PWA)

## Enforced gates
- `.pre-commit-config.yaml`: backend hooks (ruff, ty via `uv run`) run before each commit. Requires a one-time `uv tool install pre-commit` + `pre-commit install`.
- `.husky/pre-commit`: frontend lint+build, only when `frontend/` is staged. Important: Husky needs cwd = git root → `frontend/package.json` has `"prepare": "cd .. && husky"`.
- `.github/workflows/lint.yml`: ruff/format/ty (backend job) + ESLint/build (frontend job) on every push/PR to `main`.
- `main` is protected via branch protection: status checks `backend` + `frontend` must be green (PRs with red lint cannot be merged).
- Version pinning: `ruff`/`ty` live in `[dependency-groups] dev` (`backend/pyproject.toml`), frozen via `uv.lock` (`uv sync --frozen`). Pin GitHub Action refs exactly (e.g. `astral-sh/setup-uv@v10.2.0`, there is no rolling `v10` tag).
- Merge Dependabot minor/patch PRs; review major bumps critically (wait if peer lint compatibility is limited).

## Completion notification via ntfy

### When
- **Whenever a work item is finished**: changes validated (lint/build/tests) AND pushed to all remotes. Never before the push, never for merely planned/stopped local work.
- **One notification per work item**, not per commit (multiple commits → one summary with all SHAs).
- No notifications for: intermediate states, purely informational replies, questions, unverified work.
- Optional (recommended): a short error notification when work had to be blocked or aborted (What? Why? What is left open?).

### What to include
- Short title: `<project name>: <topic> <status>` (e.g. `simple-time-tracking: ruff/ty clean + CI lint active`).
- Message: 2–4 sentences in German:
  1. what was done (the key points, no file list),
  2. last commit SHA(s) + that everything was pushed to all remotes,
  3. verification result (e.g. "Lint green, Docker build green"),
  4. open risks/warnings (e.g. failing side runs, security alerts).
- No secrets, no long logs, no markdown needed (ntfy renders plain text).

### How (in opencode)
- Call the tool `ntfy_ntfy_me` with `title` + `message`; server/topic come from the environment variables `NTFY_URL`/`NTFY_TOPIC`. If a token is needed use `NTFY_TOKEN`/accessToken, **never hardcode it**.
- Without a dedicated tool (curl):
  `curl -d "message" -H "Title: <projektname>: ..." "$NTFY_URL/$NTFY_TOPIC"`

### Reference example
Title: `simple-time-tracking: ruff/ty clean + CI lint active`
Message: `Ruff 293→0, ty 69→0, CI lint job (ruff+ty) green, Docker build green. 5 commits pushed to both remotes (last: aa7eb4c). Note: 9 open Dependabot security alerts (3 high).`

## Replication template (take it to other repos)
To set up the same QA baseline in another repository, run the following there:

1. **Backend (Python/uv):** `uv add --dev ruff ty`; add `[tool.ruff]` with a matching `target-version`, `extend-exclude` only for generated folders (e.g. `alembic/versions`) with a justification comment; fix all findings down to 0 (broad excepts only with `# noqa` + justification).
2. **CI:** `.github/workflows/lint.yml` — triggers push+PR on main; job `backend`: `actions/checkout@v7`, `astral-sh/setup-uv@v10.2.0`, `uv sync --frozen --group dev`, then `uv run ruff check .` / `ruff format --check .` / `ty check .`. Optional second job `frontend`: `actions/setup-node@v7` (node 22, `cache: npm`), `npm ci`, `npm run lint`, `npm run build`.
3. **Pre-commit:** `.pre-commit-config.yaml` in the repo root — local hooks with `entry: bash -c 'cd backend && uv run …'`, `language: system`, `pass_filenames: false`, scope on `^backend/.*\.py$`.
4. **Husky (if frontend):** `npm add -D husky`, hook `.husky/pre-commit` in the git root (not in the package folder!) with a `git diff --cached --name-only | grep -q '^frontend/'` gate → `cd frontend && npm run lint && npm run build`; `"prepare": "cd .. && husky"`.
5. **Branch protection:** `gh api --method PUT repos/<owner>/<repo>/branches/main/protection` with `required_status_checks: { strict: false, contexts: ["backend","frontend"] }` (job names of the lint workflow), `enforce_admins: false`.
6. **Completion criteria:** all checks = 0/green, CI run on GitHub green, hooks run locally, both remotes pushed.