"""Topic progress state machine. This module is the only place that changes a topic's status.

All functions flush but never commit: the calling route owns the transaction, so a
status change, its history row and any achievements it triggers commit atomically.
"""
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Topic, TopicObjective, TopicStatusHistory, User, UserAchievement, UserObjectiveDone, UserTopicProgress,
)
from app.services.common import user_today
from app.services.gamification import XP_PER_OBJECTIVE, topic_xp


def get_progress(db: Session, user: User, topic: Topic) -> UserTopicProgress:
    row = db.scalar(
        select(UserTopicProgress).where(UserTopicProgress.user_id == user.id, UserTopicProgress.topic_id == topic.id)
    )
    if row is None:
        row = UserTopicProgress(user_id=user.id, topic_id=topic.id, status="not_started", priority="medium", exercises_done=[])
        db.add(row)
        db.flush()
    return row


def effective_difficulty(topic: Topic, progress: UserTopicProgress | None) -> str:
    return (progress.difficulty if progress and progress.difficulty else topic.difficulty)


def _record(db: Session, user: User, topic: Topic, old: str, new: str, on: date, xp: int = 0) -> None:
    db.add(TopicStatusHistory(user_id=user.id, topic_id=topic.id, from_status=old, to_status=new, xp=xp, occurred_on=on))


def start_topic(db: Session, user: User, topic: Topic) -> UserTopicProgress:
    p = get_progress(db, user, topic)
    if p.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Topic is completed. Reopen it to continue learning.")
    if p.status == "not_started":
        today = user_today(user)
        _record(db, user, topic, "not_started", "in_progress", today)
        p.status = "in_progress"
        p.start_date = p.start_date or today
        db.flush()
    return p


def complete_topic(db: Session, user: User, topic: Topic, on: date | None) -> UserTopicProgress:
    """Only called after the user explicitly confirmed completion."""
    p = get_progress(db, user, topic)
    if p.status == "completed":
        return p  # idempotent: no double XP
    when = on or user_today(user)
    old = p.status
    p.status = "completed"
    p.completed_date = when
    p.start_date = p.start_date or when
    _record(db, user, topic, old, "completed", when, xp=topic_xp(effective_difficulty(topic, p)))
    db.flush()
    return p


def reopen_topic(db: Session, user: User, topic: Topic) -> UserTopicProgress:
    p = get_progress(db, user, topic)
    if p.status != "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Topic is not completed")
    net_xp = db.scalar(
        select(func.coalesce(func.sum(TopicStatusHistory.xp), 0)).where(
            TopicStatusHistory.user_id == user.id, TopicStatusHistory.topic_id == topic.id
        )
    ) or 0
    p.status = "in_progress"
    p.completed_date = None
    _record(db, user, topic, "completed", "in_progress", user_today(user), xp=-int(net_xp))
    db.flush()
    return p


def set_objective_done(db: Session, user: User, topic: Topic, objective: TopicObjective, done: bool) -> None:
    existing = db.get(UserObjectiveDone, (user.id, objective.id))
    if done and existing is None:
        db.add(UserObjectiveDone(user_id=user.id, objective_id=objective.id))
        p = get_progress(db, user, topic)
        if p.status == "not_started":  # working on an objective means the topic is underway
            today = user_today(user)
            _record(db, user, topic, "not_started", "in_progress", today)
            p.status = "in_progress"
            p.start_date = p.start_date or today
    elif not done and existing is not None:
        db.delete(existing)
    db.flush()


def total_xp(db: Session, user: User) -> int:
    history = db.scalar(select(func.coalesce(func.sum(TopicStatusHistory.xp), 0)).where(TopicStatusHistory.user_id == user.id)) or 0
    ach = db.scalar(select(func.coalesce(func.sum(UserAchievement.xp_awarded), 0)).where(UserAchievement.user_id == user.id)) or 0
    objectives = db.scalar(select(func.count()).select_from(UserObjectiveDone).where(UserObjectiveDone.user_id == user.id)) or 0
    return max(int(history) + int(ach) + objectives * XP_PER_OBJECTIVE, 0)
