"""Achievement evaluation. Rules are data (db/achievements_seed.py); this module interprets them."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Achievement, Category, Milestone, StudySession, Topic, User, UserAchievement, UserTopicProgress,
)
from app.services import activity

DSA_CATEGORY_SLUG = "programming-dsa"


def _facts(db: Session, user: User) -> dict:
    completed = db.execute(
        select(Topic.slug, Topic.category_id, Topic.user_id)
        .join(UserTopicProgress, UserTopicProgress.topic_id == Topic.id)
        .where(UserTopicProgress.user_id == user.id, UserTopicProgress.status == "completed")
    ).all()
    completed_slugs = {r.slug for r in completed}

    # Category completion is judged on built-in topics only, so adding a custom topic can never
    # make a finished category "unfinished".
    builtin = db.execute(select(Topic.slug, Category.slug.label("cat")).join(Category, Category.id == Topic.category_id).where(Topic.user_id.is_(None))).all()
    by_cat: dict[str, set[str]] = {}
    for slug, cat in builtin:
        by_cat.setdefault(cat, set()).add(slug)
    completed_categories = {c for c, slugs in by_cat.items() if slugs <= completed_slugs}

    # "Problem Solver" is about DSA problems, so only sessions filed under Programming & DSA count
    # (a session linked to a topic inherits that topic's category).
    problems = db.scalar(
        select(func.coalesce(func.sum(StudySession.problems_solved), 0))
        .select_from(StudySession)
        .join(Category, Category.id == StudySession.category_id)
        .where(StudySession.user_id == user.id, Category.slug == DSA_CATEGORY_SLUG)
    ) or 0
    st = activity.streaks(db, user)
    return {
        "completed_slugs": completed_slugs,
        "topics_completed": len(completed),
        "completed_categories": completed_categories,
        "total_categories": len(by_cat),
        "problems_solved": int(problems),
        "study_hours": activity.total_minutes(db, user) / 60,
        "streak": st["longest"],
    }


def _met(a: Achievement, f: dict) -> bool:
    t, v = a.rule_type, a.rule_value
    if t == "topics_completed":
        return f["topics_completed"] >= v
    if t == "problems_solved":
        return f["problems_solved"] >= v
    if t == "topics_all":
        return set(a.rule_data) <= f["completed_slugs"]
    if t == "category_completed":
        return set(a.rule_data) <= f["completed_categories"]
    if t == "all_categories":
        return f["total_categories"] > 0 and len(f["completed_categories"]) >= f["total_categories"]
    if t == "streak":
        return f["streak"] >= v
    if t == "study_hours":
        return f["study_hours"] >= v
    return False


def evaluate(db: Session, user: User) -> list[Achievement]:
    """Unlock any newly satisfied achievements, complete category milestones, return new unlocks."""
    facts = _facts(db, user)
    have = set(db.scalars(select(UserAchievement.achievement_id).where(UserAchievement.user_id == user.id)))
    unlocked: list[Achievement] = []
    for a in db.scalars(select(Achievement).order_by(Achievement.sort_order)):
        if a.id not in have and _met(a, facts):
            db.add(UserAchievement(user_id=user.id, achievement_id=a.id, xp_awarded=a.xp))
            unlocked.append(a)

    cat_ids = {c.slug: c.id for c in db.scalars(select(Category))}
    done_ids = {cat_ids[s] for s in facts["completed_categories"] if s in cat_ids}
    now = datetime.now(timezone.utc)
    for m in db.scalars(select(Milestone).where(Milestone.user_id == user.id, Milestone.completed_at.is_(None), Milestone.category_id.is_not(None))):
        if m.category_id in done_ids:
            m.completed_at = now
    db.flush()
    return unlocked


def serialize_unlocked(items: list[Achievement]) -> list[dict]:
    return [{"id": a.id, "code": a.code, "name": a.name, "description": a.description, "icon": a.icon, "xp": a.xp} for a in items]
