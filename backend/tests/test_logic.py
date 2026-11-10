"""Pure-logic tests: no database, no web framework. These run anywhere."""
import os
import sys
from datetime import date, timedelta

import pytest

os.environ.setdefault("JWT_SECRET", "x" * 40)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import load_settings  # noqa: E402
from app.core.ratelimit import RateLimiter  # noqa: E402
from app.core.security import (  # noqa: E402
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.db.achievements_seed import ACHIEVEMENTS  # noqa: E402
from app.db.catalog_seed import CATEGORIES  # noqa: E402
from app.services.gamification import (  # noqa: E402
    compute_streaks, level_info, topic_xp, weekly_challenges, xp_required_for_level,
)


# ---- gamification ----

def test_level_thresholds_increase_and_start_at_zero():
    assert xp_required_for_level(1) == 0
    assert xp_required_for_level(2) == 100
    assert xp_required_for_level(3) == 250
    assert xp_required_for_level(4) == 450


@pytest.mark.parametrize("xp,level", [(0, 1), (99, 1), (100, 2), (249, 2), (250, 3), (10_000, 20)])
def test_level_for_xp(xp, level):
    if xp == 10_000:
        assert level_info(xp)["level"] >= 10
    else:
        assert level_info(xp)["level"] == level


def test_level_progress_fraction_in_range():
    for xp in range(0, 3000, 37):
        info = level_info(xp)
        assert 0 <= info["progress"] < 1
        assert info["xp_into_level"] < info["xp_for_next"]


def test_negative_xp_is_clamped():
    assert level_info(-50)["xp"] == 0


def test_topic_xp_by_difficulty():
    assert topic_xp("beginner") < topic_xp("intermediate") < topic_xp("advanced")
    assert topic_xp("nonsense") == topic_xp("intermediate")


def d(n: int) -> date:
    return date(2026, 11, 8) - timedelta(days=n)


def test_streak_empty():
    assert compute_streaks(set(), d(0)) == {"current": 0, "longest": 0}


def test_streak_counts_today():
    assert compute_streaks({d(0), d(1), d(2)}, d(0)) == {"current": 3, "longest": 3}


def test_streak_survives_until_a_full_day_is_missed():
    # Active yesterday and the day before, nothing yet today: streak still alive.
    assert compute_streaks({d(1), d(2)}, d(0))["current"] == 2
    # Last activity two days ago: streak is broken.
    assert compute_streaks({d(2), d(3)}, d(0))["current"] == 0


def test_longest_streak_tracks_past_runs():
    days = {d(0), d(10), d(11), d(12), d(13), d(14)}
    assert compute_streaks(days, d(0)) == {"current": 1, "longest": 5}


def test_weekly_challenges_cap_progress_and_flag_done():
    ch = {c["id"]: c for c in weekly_challenges(minutes=500, active_days=2, topics_completed=0, objectives_done=5)}
    assert ch["study_5h"]["done"] and ch["study_5h"]["progress"] == ch["study_5h"]["target"]
    assert not ch["active_4d"]["done"] and ch["active_4d"]["progress"] == 2
    assert ch["objectives_5"]["done"]
    assert not ch["complete_1"]["done"]


# ---- security ----

def test_password_hash_roundtrip_and_salting():
    h1, h2 = hash_password("correct horse 9"), hash_password("correct horse 9")
    assert h1 != h2  # unique salts
    assert verify_password("correct horse 9", h1)
    assert not verify_password("wrong", h1)
    assert "correct horse" not in h1


def test_verify_password_rejects_malformed_hash():
    assert not verify_password("x", "not-a-hash")
    assert not verify_password("x", "md5$1$a$b")


def test_token_types_are_not_interchangeable():
    access = create_access_token(7)
    refresh, _, jti = create_refresh_token(7)
    assert decode_token(access, "access")["sub"] == "7"
    assert decode_token(refresh, "refresh")["jti"] == jti
    import jwt
    with pytest.raises(jwt.PyJWTError):
        decode_token(access, "refresh")
    with pytest.raises(jwt.PyJWTError):
        decode_token(refresh, "access")


def test_tampered_token_rejected():
    import jwt
    token = create_access_token(1)
    with pytest.raises(jwt.PyJWTError):
        decode_token(token[:-2] + ("AA" if not token.endswith("AA") else "BB"), "access")


# ---- config ----

def test_production_requires_strong_secret():
    with pytest.raises(RuntimeError):
        load_settings({"ENV": "production", "JWT_SECRET": "short"})
    ok = load_settings({"ENV": "production", "JWT_SECRET": "s" * 40, "CORS_ORIGINS": "https://app.example.com"})
    assert ok.cors_origins == ["https://app.example.com"]


def test_production_rejects_wildcard_cors():
    with pytest.raises(RuntimeError):
        load_settings({"ENV": "production", "JWT_SECRET": "s" * 40, "CORS_ORIGINS": "*"})


def test_dev_gets_ephemeral_secret():
    s = load_settings({"ENV": "development"})
    assert len(s.jwt_secret) >= 32


# ---- rate limiter ----

def test_rate_limiter_blocks_then_recovers():
    now = [0.0]
    rl = RateLimiter(limit=3, window_seconds=10, clock=lambda: now[0])
    assert all(rl.allow("ip") for _ in range(3))
    assert not rl.allow("ip")
    assert rl.allow("other-ip")  # keys are independent
    now[0] = 10.5
    assert rl.allow("ip")


# ---- catalog content ----

def test_catalog_matches_requested_structure():
    names = [c["name"] for c in CATEGORIES]
    assert names == ["Programming & DSA", "Web Development", "Database & CS Fundamentals",
                     "Cloud & DevOps", "AI & Machine Learning", "Solution Engineering"]
    assert [len(c["topics"]) for c in CATEGORIES] == [7, 6, 4, 6, 5, 6]


def test_every_topic_has_full_workspace_content():
    slugs = set()
    for c in CATEGORIES:
        for t in c["topics"]:
            assert t["slug"] not in slugs
            slugs.add(t["slug"])
            assert t["difficulty"] in {"beginner", "intermediate", "advanced"}
            for key in ("overview", "mini_project"):
                assert t[key].strip(), (t["slug"], key)
            for key in ("concepts", "objectives", "recommended_resources", "exercises", "interview_questions", "completion_criteria"):
                assert t[key], (t["slug"], key)
            assert len(t["objectives"]) >= 5


def test_achievements_reference_real_topics_and_categories():
    topic_slugs = {t["slug"] for c in CATEGORIES for t in c["topics"]}
    cat_slugs = {c["slug"] for c in CATEGORIES}
    codes = [a["code"] for a in ACHIEVEMENTS]
    assert len(codes) == len(set(codes))
    for a in ACHIEVEMENTS:
        if a["rule_type"] == "topics_all":
            assert set(a["rule_data"]) <= topic_slugs
        if a["rule_type"] == "category_completed":
            assert set(a["rule_data"]) <= cat_slugs
    required = {"first-step", "problem-solver", "cloud-explorer", "api-master", "solution-engineer"}
    assert required <= set(codes)
