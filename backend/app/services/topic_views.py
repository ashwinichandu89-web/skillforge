"""Builds the merged (catalog + this user's progress) views the API returns for topics."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Category, LearningResource, StudySession, Topic, TopicNote, TopicObjective, User,
    UserObjectiveDone, UserTopicProgress,
)
from app.services.common import visible_topic_filter


def _summaries(db: Session, user: User, topics: list[Topic]) -> list[dict]:
    if not topics:
        return []
    ids = [t.id for t in topics]
    progress = {p.topic_id: p for p in db.scalars(
        select(UserTopicProgress).where(UserTopicProgress.user_id == user.id, UserTopicProgress.topic_id.in_(ids)))}
    totals = dict(db.execute(select(TopicObjective.topic_id, func.count()).where(TopicObjective.topic_id.in_(ids)).group_by(TopicObjective.topic_id)).all())
    done = dict(db.execute(
        select(TopicObjective.topic_id, func.count())
        .join(UserObjectiveDone, UserObjectiveDone.objective_id == TopicObjective.id)
        .where(UserObjectiveDone.user_id == user.id, TopicObjective.topic_id.in_(ids))
        .group_by(TopicObjective.topic_id)).all())
    minutes = dict(db.execute(
        select(StudySession.topic_id, func.sum(StudySession.minutes))
        .where(StudySession.user_id == user.id, StudySession.topic_id.in_(ids))
        .group_by(StudySession.topic_id)).all())

    out = []
    for t in topics:
        p = progress.get(t.id)
        status = p.status if p else "not_started"
        total, d = totals.get(t.id, 0), done.get(t.id, 0)
        pct = 100 if status == "completed" else (round(100 * d / total) if total else 0)
        out.append({
            "id": t.id, "slug": t.slug, "category_id": t.category_id, "is_custom": t.user_id is not None,
            "title": (p.title_override if p and p.title_override else t.title),
            "overview": (p.overview_override if p and p.overview_override else t.overview),
            "difficulty": (p.difficulty if p and p.difficulty else t.difficulty),
            "priority": p.priority if p else "medium",
            "status": status,
            "start_date": p.start_date if p else None,
            "target_date": p.target_date if p else None,
            "completed_date": p.completed_date if p else None,
            "estimated_hours": t.estimated_hours,
            "study_hours": round(int(minutes.get(t.id, 0) or 0) / 60, 2),
            "objectives_total": total, "objectives_done": d, "progress_pct": pct,
        })
    return out


def visible_topics(db: Session, user: User, category_id: int | None = None) -> list[Topic]:
    q = (select(Topic).join(Category, Category.id == Topic.category_id)
         .where(visible_topic_filter(user))
         .order_by(Category.sort_order, Topic.user_id.is_not(None), Topic.sort_order, Topic.id))
    if category_id is not None:
        q = q.where(Topic.category_id == category_id)
    return list(db.scalars(q))


def roadmap(db: Session, user: User) -> list[dict]:
    topics = _summaries(db, user, visible_topics(db, user))
    by_cat: dict[int, list[dict]] = {}
    for s in topics:
        by_cat.setdefault(s["category_id"], []).append(s)
    result = []
    for c in db.scalars(select(Category).order_by(Category.sort_order)):
        items = by_cat.get(c.id, [])
        completed = sum(1 for i in items if i["status"] == "completed")
        result.append({
            "id": c.id, "slug": c.slug, "name": c.name, "description": c.description, "icon": c.icon, "color": c.color,
            "total": len(items), "completed": completed,
            "in_progress": sum(1 for i in items if i["status"] == "in_progress"),
            "pct": round(100 * completed / len(items)) if items else 0,
            "topics": items,
        })
    return result


def topic_summary(db: Session, user: User, topic: Topic) -> dict:
    return _summaries(db, user, [topic])[0]


def topic_detail(db: Session, user: User, topic: Topic) -> dict:
    data = topic_summary(db, user, topic)
    progress = db.scalar(select(UserTopicProgress).where(UserTopicProgress.user_id == user.id, UserTopicProgress.topic_id == topic.id))
    done_ids = set(db.scalars(
        select(UserObjectiveDone.objective_id).join(TopicObjective, TopicObjective.id == UserObjectiveDone.objective_id)
        .where(UserObjectiveDone.user_id == user.id, TopicObjective.topic_id == topic.id)))
    ex_done = set(progress.exercises_done or []) if progress else set()
    category = db.get(Category, topic.category_id)
    notes = db.scalars(select(TopicNote).where(TopicNote.user_id == user.id, TopicNote.topic_id == topic.id).order_by(TopicNote.created_at.desc()))
    resources = db.scalars(select(LearningResource).where(LearningResource.user_id == user.id, LearningResource.topic_id == topic.id).order_by(LearningResource.created_at.desc()))
    sessions = db.scalars(select(StudySession).where(StudySession.user_id == user.id, StudySession.topic_id == topic.id).order_by(StudySession.session_date.desc(), StudySession.id.desc()).limit(10))
    data.update({
        "category": {"id": category.id, "name": category.name, "color": category.color, "slug": category.slug},
        "concepts": topic.concepts or [],
        "recommended_resources": topic.recommended_resources or [],
        "exercises": [{"index": i, "text": t, "done": i in ex_done} for i, t in enumerate(topic.exercises or [])],
        "mini_project": topic.mini_project,
        "interview_questions": topic.interview_questions or [],
        "completion_criteria": topic.completion_criteria or [],
        "objectives": [{"id": o.id, "text": o.text, "done": o.id in done_ids} for o in topic.objectives],
        "notes": [{"id": n.id, "content": n.content, "created_at": n.created_at, "updated_at": n.updated_at} for n in notes],
        "resources": [{"id": r.id, "title": r.title, "kind": r.kind, "url": r.url, "has_file": bool(r.s3_key), "filename": r.filename, "notes": r.notes} for r in resources],
        "sessions": [{"id": s.id, "session_date": s.session_date, "minutes": s.minutes, "problems_solved": s.problems_solved, "notes": s.notes} for s in sessions],
    })
    return data
