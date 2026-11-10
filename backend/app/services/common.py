from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Category, Topic, User


def user_tz(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def user_today(user: User) -> date:
    return datetime.now(user_tz(user)).date()


def week_start(d: date) -> date:
    """Monday of the week containing d."""
    return d - timedelta(days=d.weekday())


def visible_topic_filter(user: User):
    """Built-in topics plus this user's own custom topics. Never another user's."""
    return or_(Topic.user_id.is_(None), Topic.user_id == user.id)


def get_visible_topic(db: Session, user: User, topic_id: int) -> Topic:
    topic = db.scalar(select(Topic).where(Topic.id == topic_id, visible_topic_filter(user)))
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")
    return topic


def get_category(db: Session, category_id: int) -> Category:
    cat = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return cat


def not_found(what: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")
