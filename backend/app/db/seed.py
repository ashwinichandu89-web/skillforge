"""Idempotent seeding of the built-in catalog and achievements.

Run:  python -m app.db.seed
Safe to run on every deploy: rows are matched by slug/code and updated in place.
Per-user progress is never touched.
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.achievements_seed import ACHIEVEMENTS
from app.db.catalog_seed import CATEGORIES
from app.models import Achievement, Category, Topic, TopicObjective

log = logging.getLogger(__name__)

TOPIC_FIELDS = (
    "title", "overview", "difficulty", "estimated_hours", "concepts", "recommended_resources",
    "exercises", "mini_project", "interview_questions", "completion_criteria",
)


def seed_catalog(db: Session) -> None:
    existing_cats = {c.slug: c for c in db.scalars(select(Category))}
    existing_topics = {t.slug: t for t in db.scalars(select(Topic).where(Topic.user_id.is_(None)))}

    for c_order, c in enumerate(CATEGORIES):
        cat = existing_cats.get(c["slug"])
        if cat is None:
            cat = Category(slug=c["slug"])
            db.add(cat)
        cat.name, cat.description, cat.icon, cat.color, cat.sort_order = (
            c["name"], c["description"], c["icon"], c["color"], c_order,
        )
        db.flush()

        for t_order, t in enumerate(c["topics"]):
            topic = existing_topics.get(t["slug"])
            if topic is None:
                topic = Topic(slug=t["slug"], user_id=None, category_id=cat.id)
                db.add(topic)
            topic.category_id = cat.id
            topic.sort_order = t_order
            for f in TOPIC_FIELDS:
                setattr(topic, f, t[f])
            db.flush()

            # Sync objectives by position so existing user ticks (keyed by objective id) survive text edits.
            current = list(topic.objectives)
            for i, text in enumerate(t["objectives"]):
                if i < len(current):
                    current[i].text, current[i].sort_order = text, i
                else:
                    topic.objectives.append(TopicObjective(text=text, sort_order=i))
            for extra in current[len(t["objectives"]):]:
                db.delete(extra)


def seed_achievements(db: Session) -> None:
    existing = {a.code: a for a in db.scalars(select(Achievement))}
    for order, a in enumerate(ACHIEVEMENTS):
        row = existing.get(a["code"]) or Achievement(code=a["code"])
        for k, v in a.items():
            setattr(row, k, v)
        row.sort_order = order
        db.add(row)


def run() -> None:
    from app.core.logging import configure_logging
    from app.db.session import SessionLocal

    configure_logging()
    with SessionLocal() as db:
        seed_catalog(db)
        seed_achievements(db)
        db.commit()
    log.info("Catalog and achievements seeded")


if __name__ == "__main__":
    run()
