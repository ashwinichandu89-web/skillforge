"""API integration tests against an in-memory SQLite database.

Requires the full dependency set (pip install -r requirements-dev.txt). They are skipped
automatically when FastAPI, SQLAlchemy or httpx are not installed.
"""
import dataclasses
import os
import sys

import pytest

os.environ.setdefault("JWT_SECRET", "x" * 40)
os.environ.setdefault("AUTH_RATE_LIMIT", "1000")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")
pytest.importorskip("psycopg2")  # app.db.session builds a PostgreSQL engine at import time

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.seed import seed_achievements, seed_catalog  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as s:
        seed_catalog(s)
        seed_achievements(s)
        s.commit()

    def override():
        db = Session()
        try:
            yield db
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client, email="a@example.com", name="Alice"):
    r = client.post("/api/auth/register", json={"email": email, "name": name, "password": "password123", "timezone": "Asia/Kolkata"})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


def topic_id(client, headers, slug):
    for cat in client.get("/api/roadmap", headers=headers).json():
        for t in cat["topics"]:
            if t["slug"] == slug:
                return t["id"]
    raise AssertionError(slug)


# ---------- auth ----------

def test_register_login_me(client):
    headers, _ = register(client)
    assert client.get("/api/auth/me", headers=headers).json()["email"] == "a@example.com"
    ok = client.post("/api/auth/login", json={"email": "A@Example.com", "password": "password123"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"email": "a@example.com", "password": "nope"})
    assert bad.status_code == 401


def test_duplicate_email_rejected_and_weak_password_rejected(client):
    register(client)
    dup = client.post("/api/auth/register", json={"email": "a@example.com", "name": "x", "password": "password123"})
    assert dup.status_code == 409
    weak = client.post("/api/auth/register", json={"email": "b@example.com", "name": "x", "password": "onlyletters"})
    assert weak.status_code == 422


def test_protected_routes_require_token(client):
    assert client.get("/api/roadmap").status_code == 401
    assert client.get("/api/stats/overview", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_refresh_rotates_and_late_reuse_revokes_everything(client, monkeypatch):
    # Grace window off: any reuse of a rotated-out token is treated as theft.
    monkeypatch.setattr("app.api.auth.settings", dataclasses.replace(settings, refresh_reuse_grace_seconds=0))
    _, tokens = register(client)
    first = tokens["refresh_token"]
    second = client.post("/api/auth/refresh", json={"refresh_token": first})
    assert second.status_code == 200
    reuse = client.post("/api/auth/refresh", json={"refresh_token": first})
    assert reuse.status_code == 401
    # Reuse detection revoked the whole family, including the newly issued token.
    assert client.post("/api/auth/refresh", json={"refresh_token": second.json()["refresh_token"]}).status_code == 401


def test_two_tabs_refreshing_at_once_do_not_log_the_user_out(client):
    _, tokens = register(client)
    first = tokens["refresh_token"]
    winner = client.post("/api/auth/refresh", json={"refresh_token": first})
    assert winner.status_code == 200
    # The second tab presents the same (now rotated) token a moment later: refused, but not treated as theft.
    assert client.post("/api/auth/refresh", json={"refresh_token": first}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": winner.json()["refresh_token"]}).status_code == 200


def test_access_token_cannot_be_used_as_refresh(client):
    _, tokens = register(client)
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401


def test_logout_revokes_refresh_token(client):
    _, tokens = register(client)
    assert client.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


# ---------- catalog and completion rules ----------

def test_roadmap_has_six_categories_and_34_topics(client):
    headers, _ = register(client)
    rm = client.get("/api/roadmap", headers=headers).json()
    assert len(rm) == 6
    assert sum(c["total"] for c in rm) == 34
    assert all(t["status"] == "not_started" for c in rm for t in c["topics"])


def test_completion_requires_explicit_confirmation(client):
    headers, _ = register(client)
    tid = topic_id(client, headers, "rest-apis")
    no = client.post(f"/api/topics/{tid}/complete", json={"confirm": False}, headers=headers)
    assert no.status_code == 400
    assert client.get(f"/api/topics/{tid}", headers=headers).json()["status"] != "completed"


def test_ticking_all_objectives_does_not_complete_topic(client):
    headers, _ = register(client)
    tid = topic_id(client, headers, "rest-apis")
    for o in client.get(f"/api/topics/{tid}", headers=headers).json()["objectives"]:
        r = client.put(f"/api/topics/{tid}/objectives/{o['id']}", json={"done": True}, headers=headers)
        assert r.status_code == 200
    t = client.get(f"/api/topics/{tid}", headers=headers).json()
    assert t["objectives_done"] == t["objectives_total"]
    assert t["status"] == "in_progress"


def test_complete_awards_xp_once_unlocks_first_step_and_reopen_reverses(client):
    headers, _ = register(client)
    tid = topic_id(client, headers, "rest-apis")  # intermediate -> 100 XP
    done = client.post(f"/api/topics/{tid}/complete", json={"confirm": True}, headers=headers).json()
    assert done["status"] == "completed" and done["completed_date"]
    assert "first-step" in [a["code"] for a in done["unlocked_achievements"]]
    assert "api-master" in [a["code"] for a in done["unlocked_achievements"]]

    xp_after = client.get("/api/achievements", headers=headers).json()["level"]["xp"]
    client.post(f"/api/topics/{tid}/complete", json={"confirm": True}, headers=headers)  # idempotent
    assert client.get("/api/achievements", headers=headers).json()["level"]["xp"] == xp_after

    client.post(f"/api/topics/{tid}/reopen", headers=headers)
    t = client.get(f"/api/topics/{tid}", headers=headers).json()
    assert t["status"] == "in_progress" and t["completed_date"] is None
    after_reopen = client.get("/api/achievements", headers=headers).json()["level"]["xp"]
    assert after_reopen == xp_after - 100


def test_dashboard_numbers_come_from_data(client):
    headers, _ = register(client)
    assert client.get("/api/stats/overview", headers=headers).json()["totals"]["completed"] == 0
    tid = topic_id(client, headers, "git-github")
    client.post(f"/api/topics/{tid}/complete", json={"confirm": True}, headers=headers)
    client.post("/api/sessions", json={"topic_id": tid, "minutes": 90, "problems_solved": 3}, headers=headers)
    ov = client.get("/api/stats/overview", headers=headers).json()
    assert ov["totals"]["completed"] == 1 and ov["totals"]["remaining"] == 33
    assert ov["study_hours"] == 1.5
    assert ov["streak"]["current"] >= 1
    assert ov["recent_completed"][0]["slug"] == "git-github"


def test_custom_topic_edit_and_builtin_override(client):
    headers, _ = register(client)
    cat = client.get("/api/roadmap", headers=headers).json()[0]["id"]
    created = client.post("/api/topics", json={"category_id": cat, "title": "Kotlin", "objectives": ["Syntax", "Coroutines"]}, headers=headers)
    assert created.status_code == 201
    custom = created.json()
    assert custom["is_custom"] and len(custom["objectives"]) == 2
    assert client.patch(f"/api/topics/{custom['id']}", json={"title": "Kotlin Basics"}, headers=headers).json()["title"] == "Kotlin Basics"

    builtin = topic_id(client, headers, "javascript")
    edited = client.patch(f"/api/topics/{builtin}", json={"priority": "high", "title": "JS deep dive"}, headers=headers).json()
    assert edited["priority"] == "high" and edited["title"] == "JS deep dive"
    # a second user still sees the shared original title
    h2, _ = register(client, "b@example.com", "Bob")
    assert client.get(f"/api/topics/{builtin}", headers=h2).json()["title"] == "JavaScript"
    assert client.delete(f"/api/topics/{builtin}", headers=headers).status_code == 403


# ---------- isolation between users ----------

def test_users_cannot_see_or_change_each_others_data(client):
    ha, _ = register(client, "a@example.com", "Alice")
    hb, _ = register(client, "b@example.com", "Bob")

    tid = topic_id(client, ha, "docker")
    client.post(f"/api/topics/{tid}/complete", json={"confirm": True}, headers=ha)
    assert client.get(f"/api/topics/{tid}", headers=hb).json()["status"] == "not_started"

    note = client.post(f"/api/topics/{tid}/notes", json={"content": "alice private"}, headers=ha).json()
    assert client.put(f"/api/notes/{note['id']}", json={"content": "hacked"}, headers=hb).status_code == 404
    assert client.delete(f"/api/notes/{note['id']}", headers=hb).status_code == 404
    assert client.get(f"/api/topics/{tid}/notes", headers=hb).json() == []

    custom = client.post("/api/topics", json={"category_id": 1, "title": "Alice only"}, headers=ha).json()
    assert client.get(f"/api/topics/{custom['id']}", headers=hb).status_code == 404

    res = client.post("/api/resources", json={"title": "Docs", "kind": "docs", "url": "https://docs.docker.com"}, headers=ha).json()
    assert client.get("/api/resources", headers=hb).json() == []
    assert client.delete(f"/api/resources/{res['id']}", headers=hb).status_code == 404

    plan = client.post("/api/plans", json={"title": "Study", "plan_date": "2026-11-09", "planned_minutes": 30}, headers=ha).json()
    assert client.patch(f"/api/plans/{plan['id']}", json={"status": "done"}, headers=hb).status_code == 404

    sess = client.post("/api/sessions", json={"minutes": 20}, headers=ha).json()["session"]
    assert client.delete(f"/api/sessions/{sess['id']}", headers=hb).status_code == 404


# ---------- validation ----------

def test_resource_validation(client):
    headers, _ = register(client)
    assert client.post("/api/resources", json={"title": "x", "kind": "docs", "url": "javascript:alert(1)"}, headers=headers).status_code == 422
    assert client.post("/api/resources", json={"title": "x", "kind": "docs"}, headers=headers).status_code == 422
    foreign = client.post("/api/resources", json={"title": "x", "kind": "pdf", "s3_key": "users/999/other.pdf"}, headers=headers)
    assert foreign.status_code == 400


def test_session_validation(client):
    headers, _ = register(client)
    assert client.post("/api/sessions", json={"minutes": 0}, headers=headers).status_code == 422
    assert client.post("/api/sessions", json={"minutes": 30, "session_date": "2999-01-01"}, headers=headers).status_code == 422


def test_problem_solver_counts_only_dsa_sessions(client):
    headers, _ = register(client)
    roadmap = client.get("/api/roadmap", headers=headers).json()
    dsa = next(c["id"] for c in roadmap if c["slug"] == "programming-dsa")
    cloud = next(c["id"] for c in roadmap if c["slug"] == "cloud-devops")

    # 25 problems filed under another category, or under none, must not unlock it.
    off_topic = client.post("/api/sessions", json={"minutes": 60, "problems_solved": 25, "category_id": cloud}, headers=headers).json()
    assert "problem-solver" not in [a["code"] for a in off_topic["unlocked_achievements"]]
    uncategorised = client.post("/api/sessions", json={"minutes": 60, "problems_solved": 25}, headers=headers).json()
    assert "problem-solver" not in [a["code"] for a in uncategorised["unlocked_achievements"]]

    r = client.post("/api/sessions", json={"minutes": 60, "problems_solved": 25, "category_id": dsa}, headers=headers).json()
    assert "problem-solver" in [a["code"] for a in r["unlocked_achievements"]]


def test_validation_messages_are_user_readable(client):
    r = client.post("/api/auth/register", json={"email": "a@example.com", "name": "x", "password": "onlyletters"})
    assert r.status_code == 422
    assert r.json()["detail"] == "Password must contain at least one letter and one number"


def test_resource_reports_has_file_without_leaking_s3_key(client):
    headers, _ = register(client)
    me = client.get("/api/auth/me", headers=headers).json()
    link = client.post("/api/resources", json={"title": "Docs", "kind": "docs", "url": "https://example.com"}, headers=headers).json()
    assert link["has_file"] is False and "s3_key" not in link
    pdf = client.post(
        "/api/resources", json={"title": "Notes", "kind": "pdf", "s3_key": f"users/{me['id']}/abc/notes.pdf", "filename": "notes.pdf"}, headers=headers,
    ).json()
    assert pdf["has_file"] is True and "s3_key" not in pdf


def test_planner_week_reports_planned_vs_actual(client):
    headers, _ = register(client)
    week = client.get("/api/planner/week", headers=headers).json()
    today = next(d for d in week["days"] if d["is_today"])["date"]
    client.post("/api/plans", json={"title": "Arrays", "plan_date": today, "planned_minutes": 60, "category_id": 1}, headers=headers)
    client.post("/api/sessions", json={"minutes": 45, "category_id": 1}, headers=headers)
    week = client.get("/api/planner/week", headers=headers).json()
    assert week["totals"] == {"planned_minutes": 60, "actual_minutes": 45}
    cat = next(c for c in week["categories"] if c["category_id"] == 1)
    assert cat["planned_minutes"] == 60 and cat["actual_minutes"] == 45


def test_health(client):
    assert client.get("/api/openapi.json").status_code == 200
