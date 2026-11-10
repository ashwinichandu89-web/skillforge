# SkillForge: Solution Engineer Learning Tracker

A full-stack learning platform for working through the Solution Engineer roadmap: 6 categories and 34 seeded topics, each with objectives, exercises, a mini-project, interview questions, notes and resources. Progress is stored in PostgreSQL and synced across devices; the browser only keeps a read cache.

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide, Recharts, React Router |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PyJWT |
| Data | PostgreSQL (Docker locally) |
| Ops | Docker Compose, GitHub Actions CI |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the component map and data model,.

## Features
Overview dashboard · Learning Roadmap with filters and custom topics · per-topic Workspace (objectives, exercises, notes, resources, study log; a topic is completed **only** when you confirm) · Study Planner (weekly blocks, daily target, planned vs actual, milestones) · Analytics (category completion, weekly/monthly charts, yearly heatmap, streaks) · Achievements (XP, levels, badges, daily goal, weekly challenges) · Resource Library (links and PDFs) · Settings. JWT access + rotating refresh tokens, per-user data isolation, rate-limited auth.

## Run locally with Docker
```bash
cp .env.example .env
# set POSTGRES_PASSWORD and JWT_SECRET (python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up --build
```
Open http://localhost:8080 and register. API docs (Swagger): http://localhost:8080/api/docs. Migrations and the topic catalog are applied automatically on backend start.

## Run without Docker
```bash
# database
createdb skillforge   # or any PostgreSQL 14+
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
export DATABASE_URL=postgresql+psycopg2://USER:PASS@localhost:5432/skillforge
alembic upgrade head && python -m app.db.seed
uvicorn app.main:app --reload        # http://localhost:8000/api/docs
# frontend (second terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api to :8000
```

## Configuration (environment variables)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy URL for PostgreSQL |
| `JWT_SECRET` | ≥32 random chars. **Required in production**; the app refuses to start without it |
| `ENV` | `production` enables strict checks (no wildcard CORS) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `S3_BUCKET`, `AWS_REGION` | Optional. PDF uploads are off when unset (links and notes still work) |
| `AUTH_RATE_LIMIT`, `AUTH_RATE_WINDOW_SECONDS` | Login/register attempts per IP per window |
| `TRUST_PROXY` | `1` only behind a trusted proxy/load balancer |

Secrets live only in environment variables or `.env.production` on the server. `.env*` is git-ignored and nothing secret reaches the frontend bundle.

## Tests
```bash
cd backend && pytest -q          # schemas, gamification/analytics logic, API (needs the requirements installed)
cd frontend && npm run build     # type-checks, then bundles
```
CI (`.github/workflows/ci.yml`) also applies the migration up, down and up again against a real PostgreSQL service.

## Backups
```bash
docker compose exec db pg_dump -U skillforge skillforge > backup.sql          # back up
docker compose exec -T db psql -U skillforge skillforge < backup.sql           # restore
```
