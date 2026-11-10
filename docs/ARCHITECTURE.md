# SkillForge Architecture

```
skillforge/
├── backend/                  FastAPI service (Python)
│   ├── app/
│   │   ├── main.py           App factory, CORS, middleware, routers, error handlers
│   │   ├── core/             config (env), security (hash/JWT), logging, rate limiting
│   │   ├── db/               engine/session, declarative base, seed catalog + seeding
│   │   ├── models/           SQLAlchemy ORM models (12 tables)
│   │   ├── schemas/          Pydantic request/response validation
│   │   ├── services/         Business logic (progress, gamification, analytics)
│   │   └── api/              Routers: auth, catalog, topics, planner, resources, ...
│   ├── alembic/              Migrations (versions/0001_initial.py)
│   └── tests/                pytest suites
├── frontend/                 React + TS + Tailwind SPA
│   └── src/
│       ├── api/              Typed fetch client, token refresh, cache layer
│       ├── context/          Auth + data providers
│       ├── components/       Reusable UI (Card, ProgressRing, Modal, Sidebar, ...)
│       ├── pages/            Overview, Roadmap, Topic Workspace, Planner, Analytics,
│       │                     Achievements, Resources, Settings, Login/Register
│       └── lib/              Formatting helpers
├── .github/workflows/        CI (tests, build)
└── docker-compose.yml        Local stack: Postgres + API + web
```

## Component purposes

| Component | Purpose |
|---|---|
| `core/security.py` | Password hashing (PBKDF2-SHA256 via stdlib, no extra dependency) and JWT access/refresh creation and validation. Refresh tokens carry a `type` claim and a `jti` stored hashed in DB so they can be revoked on logout. |
| `core/ratelimit.py` | In-memory sliding-window limiter for auth endpoints. Single-process only; use Redis or an API gateway when running multiple instances. |
| `db/catalog_seed.py` | The six categories and 34 topics, each with overview, concepts, objectives, resources, exercises, mini-project, interview questions and completion criteria. Stored in the database; the UI reads it through the API. |
| `services/progress.py` | The only place that changes topic status. Writes completion history, awards XP, evaluates achievements in one transaction. |
| `services/gamification.py` | Pure functions for level and XP maths and streak calculation (unit tested without a DB). |
| `services/analytics.py` | SQL aggregation for dashboard and analytics. No stored statistics: every number is computed from rows. |
| `api/deps.py` | `get_db`, `get_current_user`. Every query filters by `user.id`. |
| `frontend/src/api/client.ts` | Single fetch wrapper: attaches the access token, refreshes once on 401, normalises errors. |
| `frontend/src/api/cache.ts` | Read cache in localStorage for fast first paint and offline reads. The server remains the source of truth; writes always go to the API. |

## Data ownership model

Shared reference data (`categories`, `topics`, `topic_objectives`, `achievements`) have `user_id` NULL for built-in rows. Custom topics have `user_id` set. All per-user state lives in `user_topic_progress`, `user_objective_progress`-style rows (`topic_objectives` completion is tracked in `user_objective_done`), `topic_notes`, `study_sessions`, `study_plans`, `learning_resources`, `milestones`, `user_achievements`. Endpoints always scope by the authenticated user.

## Completion rules

- Objectives can be ticked independently.
- A topic becomes `completed` only through `POST /topics/{id}/complete` with `confirm: true`.
- Status changes append to `topic_status_history` (completion history requirement).
