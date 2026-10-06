# simple-time-tracking — Entwicklungsrichtlinien

## Projekt
- PWA-Zeit-Tracker. Frontend React 19 / Vite / TypeScript 6 in `frontend/`, API FastAPI / SQLAlchemy / uv in `backend/`.
- Zwei Remotes — **immer beide pushen**: `origin` (git.familie-heise.de) und `github` (github.com/mcfetz).
- Commits im Conventional-Commit-Stil. Keine Code-Kommentare, außer sie werden explizit verlangt.

## Qualitätssicherung (verbindlich vor jedem Abschluss)
Backend (`backend/`):
- `uv run ruff check .` → 0 Findings
- `uv run ruff format --check .` → 0 Änderungen nötig
- `uv run ty check .` → 0 Fehler

Frontend (`frontend/`):
- `npm run lint` → 0 Errors
- `npm run build` → grün (inkl. Workbox-PWA)

## Erzwungene Gates
- `.pre-commit-config.yaml`: backend-Hooks (ruff, ty via `uv run`), laufen vor jedem Commit. Benötigt einmalig `uv tool install pre-commit` + `pre-commit install`.
- `.husky/pre-commit`: frontend lint+build, nur wenn `frontend/` staged ist. Wichtig: Husky braucht cwd = Git-Root → `frontend/package.json` hat `"prepare": "cd .. && husky"`.
- `.github/workflows/lint.yml`: ruff/format/ty (backend-Job) + ESLint/Build (frontend-Job) auf jedem Push/PR zu `main`.
- `main` ist per Branch Protection geschützt: Status-Checks `backend` + `frontend` müssen grün sein (PRs mit rotem Lint nicht mergbar).
- Versions-Pinning: `ruff`/`ty` in `[dependency-groups] dev` (`backend/pyproject.toml`), gefixt über `uv.lock` (`uv sync --frozen`). GitHub-Action-Refs exakt pinnen (z. B. `astral-sh/setup-uv@v10.2.0`, es gibt kein rolling `v10`-Tag).
- Dependabot-Minor/Patch-PRs mergen; Major-Bumps kritisch prüfen (bei eingeschränkter Peer-Lint-Kompatibilität ggf. abwarten).

## Abschluss-Notification per ntfy

### Wann
- **Immer dann, wenn eine Arbeitseinheit fertig ist**: Änderungen validiert (Lint/Build/Tests) UND auf alle Remotes gepusht. Nie vor dem Push, nie für nur lokal angedachte/gestoppte Arbeit.
- **Eine Notification pro Arbeitseinheit**, nicht pro Commit (mehrere Commits → eine Zusammenfassung mit allen SHAs).
- Keine Notifications für: Zwischenstände, reine Informationsantworten, Fragen, ungeprüfte Arbeit.
- Optional (empfohlen): kurze Fehler-Notification, wenn Arbeit blockiert oder abgebrochen werden musste (Was? Warum? Was ist offen?).

### Was reingeschrieben wird
- Titel kurz: `<projektname>: <thema> <status>` (z.B. `simple-time-tracking: ruff/ty sauber + CI-Lint aktiv`).
- Message: 2–4 Sätze auf Deutsch:
  1. was gemacht wurde (die Kernpunkte, keine Dateiliste),
  2. letzte(n) Commit-SHA(s) + dass auf alle Remotes gepusht wurde,
  3. Verifikationsergebnis (z.B. „Lint grün, Docker-Build grün"),
  4. offene Risiken/Warnungen (z.B. rote Neben-Runs, Security-Alerts).
- Keine Secrets, keine langen Logs, kein Markdown nötig (ntfy zeigt plain text).

### Wie (in opencode)
- Tool `ntfy_ntfy_me` mit `title` + `message` aufrufen; Server/Topic kommen aus den Env-Variablen `NTFY_URL`/`NTFY_TOPIC`. Token falls nötig über `NTFY_TOKEN`/accessToken, **nie hartkodieren**.
- Ohne eigenes Tool (curl):
  `curl -d "message" -H "Title: <projektname>: ..." "$NTFY_URL/$NTFY_TOPIC"`

### Referenz-Beispiel
Title: `simple-time-tracking: ruff/ty sauber + CI-Lint aktiv`
Message: `Ruff 293→0, ty 69→0, CI-Lint-Job (ruff+ty) grün, Docker-Build grün. 5 Commits gepusht auf beide Remotes (letzter: aa7eb4c). Hinweis: 9 offene Dependabot-Security-Alerts (3 high).`

## Replikations-Vorlage (zum Mitnehmen in andere Repos)
Wenn in einem anderen Repository dieselbe QA-Baseline eingerichtet werden soll, dort ausführen:

1. **Backend (Python/uv):** `uv add --dev ruff ty`; `[tool.ruff]` mit passendem `target-version` ergänzen, `extend-exclude` nur für generierte Ordner (z. B. `alembic/versions`) mit Begründungskommentar; alle Findings beheben bis 0 (breite excepts nur mit `# noqa` + Begründung).
2. **CI:** `.github/workflows/lint.yml` — Trigger push+PR auf main; Job `backend`: `actions/checkout@v7`, `astral-sh/setup-uv@v10.2.0`, `uv sync --frozen --group dev`, dann `uv run ruff check .` / `ruff format --check .` / `ty check .`. Optional zweiter Job `frontend`: `actions/setup-node@v7` (node 22, `cache: npm`), `npm ci`, `npm run lint`, `npm run build`.
3. **Pre-commit:** `.pre-commit-config.yaml` im Repo-Root — lokale Hooks mit `entry: bash -c 'cd backend && uv run …'`, `language: system`, `pass_filenames: false`, Scope auf `^backend/.*\.py$`.
4. **Husky (falls Frontend):** `npm add -D husky`, Hook `.husky/pre-commit` im Git-Root (nicht im Package-Ordner!) mit `git diff --cached --name-only | grep -q '^frontend/'`-Gate → `cd frontend && npm run lint && npm run build`; `"prepare": "cd .. && husky"`.
5. **Branch Protection:** `gh api --method PUT repos/<owner>/<repo>/branches/main/protection` mit `required_status_checks: { strict: false, contexts: ["backend","frontend"] }` (Job-Namen des lint-Workflows), `enforce_admins: false`.
6. **Abschlusskriterien:** alle Checks = 0/grün, CI-Run auf GitHub grün, Hooks laufen lokal, beide Remotes gepusht.