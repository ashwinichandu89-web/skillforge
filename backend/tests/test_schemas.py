"""Request/response schema tests. Pure pydantic: no database, no web framework."""
import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

os.environ.setdefault("JWT_SECRET", "x" * 40)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import load_settings  # noqa: E402
from app.schemas.auth import PasswordChange, RegisterIn, UserUpdate  # noqa: E402
from app.schemas.content import ResourceCreate, ResourceOut, TopicCreate  # noqa: E402
from app.schemas.planner import PlanIn, SessionIn  # noqa: E402


def _msg(exc: ValidationError) -> str:
    return exc.errors()[0]["msg"].removeprefix("Value error, ")


# ---- auth ----

def test_register_normalises_email_and_name():
    body = RegisterIn(email="  Alice@Example.COM ", name="  Alice  ", password="password123")
    assert body.email == "alice@example.com" and body.name == "Alice"


@pytest.mark.parametrize("password", ["onlyletters", "12345678", "short1"])
def test_register_rejects_weak_passwords(password):
    with pytest.raises(ValidationError):
        RegisterIn(email="a@example.com", name="A", password=password)


def test_register_password_message_is_readable():
    with pytest.raises(ValidationError) as e:
        RegisterIn(email="a@example.com", name="A", password="onlyletters")
    assert _msg(e.value) == "Password must contain at least one letter and one number"


@pytest.mark.parametrize("email", ["nope", "a@b", "a b@example.com", "@example.com"])
def test_register_rejects_bad_email(email):
    with pytest.raises(ValidationError):
        RegisterIn(email=email, name="A", password="password123")


def test_register_rejects_unknown_timezone():
    with pytest.raises(ValidationError):
        RegisterIn(email="a@example.com", name="A", password="password123", timezone="Mars/Olympus")
    assert RegisterIn(email="a@example.com", name="A", password="password123", timezone="Asia/Kolkata").timezone == "Asia/Kolkata"


def test_user_update_bounds_daily_goal():
    assert UserUpdate(daily_goal_minutes=90).daily_goal_minutes == 90
    for bad in (0, 4, 961):
        with pytest.raises(ValidationError):
            UserUpdate(daily_goal_minutes=bad)


def test_password_change_enforces_same_policy():
    with pytest.raises(ValidationError):
        PasswordChange(current_password="x", new_password="onlyletters")


# ---- content ----

def test_topic_create_cleans_objectives_and_title():
    t = TopicCreate(category_id=1, title="  Kotlin  ", objectives=["  Syntax ", "", "   ", "Coroutines"])
    assert t.title == "Kotlin" and t.objectives == ["Syntax", "Coroutines"]


def test_topic_create_rejects_blank_title_and_overlong_objective():
    with pytest.raises(ValidationError):
        TopicCreate(category_id=1, title="   ")
    with pytest.raises(ValidationError):
        TopicCreate(category_id=1, title="ok", objectives=["x" * 301])


@pytest.mark.parametrize("url", ["javascript:alert(1)", "ftp://example.com", "https://exa mple.com", "data:text/html,hi"])
def test_resource_url_must_be_http(url):
    with pytest.raises(ValidationError):
        ResourceCreate(title="x", kind="docs", url=url)


def test_resource_empty_url_becomes_none_and_kind_is_restricted():
    assert ResourceCreate(title="x", kind="docs", url="", notes="n").url is None
    with pytest.raises(ValidationError):
        ResourceCreate(title="x", kind="video", url="https://example.com")


def _row(**over):
    base = dict(
        id=1, title="t", kind="pdf", url=None, topic_id=None, category_id=None, notes="", filename="a.pdf",
        s3_key="users/1/abc/a.pdf", created_at=datetime.now(timezone.utc),
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_resource_out_reports_has_file_and_never_serialises_s3_key():
    out = ResourceOut.model_validate(_row()).model_dump()
    assert out["has_file"] is True and "s3_key" not in out
    link = ResourceOut.model_validate(_row(s3_key=None, url="https://example.com", filename=None)).model_dump()
    assert link["has_file"] is False and "s3_key" not in link


# ---- planner ----

def test_session_and_plan_minute_bounds():
    for bad in (0, -5, 1441):
        with pytest.raises(ValidationError):
            SessionIn(minutes=bad)
        with pytest.raises(ValidationError):
            PlanIn(title="x", plan_date="2026-11-09", planned_minutes=bad)
    assert SessionIn(minutes=1440).minutes == 1440


def test_negative_problem_count_rejected():
    with pytest.raises(ValidationError):
        SessionIn(minutes=10, problems_solved=-1)


# ---- config ----

def test_refresh_grace_is_configurable_and_defaults_to_twenty_seconds():
    base = {"JWT_SECRET": "y" * 40}
    assert load_settings(base).refresh_reuse_grace_seconds == 20
    assert load_settings({**base, "REFRESH_REUSE_GRACE_SECONDS": "0"}).refresh_reuse_grace_seconds == 0
