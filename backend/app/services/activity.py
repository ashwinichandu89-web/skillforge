"""Activity facts derived from stored rows: which days the user was active, minutes per day."""
from collections import defaultdict
from datetime import date, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import StudySession, TopicStatusHistory, User, UserObjectiveDone
from app.services.common import user_today, user_tz
from app.services.gamification import compute_streaks


def minutes_by_day(db: Session, user: User, since: date | None = None) -> dict[date, int]:
    q = select(StudySession.session_date, func.sum(StudySession.minutes)).where(StudySession.user_id == user.id)
    if since:
        q = q.where(StudySession.session_date >= since)
    return {d: int(m) for d, m in db.execute(q.group_by(StudySession.session_date))}


def completions_by_day(db: Session, user: User, since: date | None = None) -> dict[date, int]:
    q = select(TopicStatusHistory.occurred_on, func.count()).where(
        TopicStatusHistory.user_id == user.id, TopicStatusHistory.to_status == "completed", TopicStatusHistory.xp > 0
    )
    if since:
        q = q.where(TopicStatusHistory.occurred_on >= since)
    return {d: int(c) for d, c in db.execute(q.group_by(TopicStatusHistory.occurred_on))}


def objective_days(db: Session, user: User, since: date | None = None) -> dict[date, int]:
    tz = user_tz(user)
    out: dict[date, int] = defaultdict(int)
    for (ts,) in db.execute(select(UserObjectiveDone.done_at).where(UserObjectiveDone.user_id == user.id)):
        if ts.tzinfo is None:  # some drivers return naive UTC timestamps
            ts = ts.replace(tzinfo=timezone.utc)
        d = ts.astimezone(tz).date()
        if since is None or d >= since:
            out[d] += 1
    return dict(out)


def active_dates(db: Session, user: User) -> set[date]:
    days = set(minutes_by_day(db, user)) | set(completions_by_day(db, user)) | set(objective_days(db, user))
    return days


def streaks(db: Session, user: User) -> dict:
    return compute_streaks(active_dates(db, user), user_today(user))


def total_minutes(db: Session, user: User) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(StudySession.minutes), 0)).where(StudySession.user_id == user.id)) or 0)


def last_n_days(today: date, n: int) -> list[date]:
    return [today - timedelta(days=i) for i in range(n - 1, -1, -1)]
