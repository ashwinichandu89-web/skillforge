from datetime import date, datetime

from sqlalchemy import (
    JSON, CheckConstraint, Date, DateTime, ForeignKey, Integer, PrimaryKeyConstraint,
    String, Text, UniqueConstraint, func, Index,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

STATUSES = ("not_started", "in_progress", "completed")
PRIORITIES = ("low", "medium", "high")


class UserTopicProgress(Base, TimestampMixin):
    __tablename__ = "user_topic_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_progress_user_topic"),
        CheckConstraint("status IN ('not_started','in_progress','completed')", name="status_valid"),
        CheckConstraint("priority IN ('low','medium','high')", name="priority_valid"),
        CheckConstraint("difficulty IS NULL OR difficulty IN ('beginner','intermediate','advanced')", name="difficulty_valid"),
        Index("ix_progress_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="not_started", server_default="not_started")
    priority: Mapped[str] = mapped_column(String(8), default="medium", server_default="medium")
    difficulty: Mapped[str | None] = mapped_column(String(16), nullable=True)  # per-user override
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exercises_done: Mapped[list] = mapped_column(JSON, default=list)  # indices into topic.exercises
    title_override: Mapped[str | None] = mapped_column(String(160), nullable=True)
    overview_override: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserObjectiveDone(Base):
    __tablename__ = "user_objective_done"
    __table_args__ = (PrimaryKeyConstraint("user_id", "objective_id", name="pk_user_objective_done"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    objective_id: Mapped[int] = mapped_column(ForeignKey("topic_objectives.id", ondelete="CASCADE"), index=True)
    done_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TopicStatusHistory(Base):
    """Append-only completion history. `xp` is signed: reopening a topic writes the negative."""

    __tablename__ = "topic_status_history"
    __table_args__ = (Index("ix_history_user_date", "user_id", "occurred_on"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str] = mapped_column(String(16))
    to_status: Mapped[str] = mapped_column(String(16))
    xp: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    occurred_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudySession(Base, TimestampMixin):
    __tablename__ = "study_sessions"
    __table_args__ = (
        CheckConstraint("minutes > 0 AND minutes <= 1440", name="minutes_range"),
        CheckConstraint("problems_solved >= 0", name="problems_nonneg"),
        Index("ix_sessions_user_date", "user_id", "session_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    session_date: Mapped[date] = mapped_column(Date)
    minutes: Mapped[int] = mapped_column(Integer)
    problems_solved: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    notes: Mapped[str] = mapped_column(Text, default="")


class TopicNote(Base, TimestampMixin):
    __tablename__ = "topic_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)


RESOURCE_KINDS = ("youtube", "docs", "github", "course", "pdf", "reference")


class LearningResource(Base, TimestampMixin):
    __tablename__ = "learning_resources"
    __table_args__ = (
        CheckConstraint("kind IN ('youtube','docs','github','course','pdf','reference')", name="kind_valid"),
        CheckConstraint("url IS NOT NULL OR s3_key IS NOT NULL OR notes <> ''", name="has_content"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300))
    icon: Mapped[str] = mapped_column(String(40), default="award")
    xp: Mapped[int] = mapped_column(Integer, default=0)
    rule_type: Mapped[str] = mapped_column(String(32))
    rule_value: Mapped[int] = mapped_column(Integer, default=1)
    rule_data: Mapped[list] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"))
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudyPlan(Base, TimestampMixin):
    """A planned study block. Actual time comes from study_sessions on the same day/category."""

    __tablename__ = "study_plans"
    __table_args__ = (
        CheckConstraint("planned_minutes > 0 AND planned_minutes <= 1440", name="planned_range"),
        CheckConstraint("status IN ('planned','done','skipped')", name="status_valid"),
        Index("ix_plans_user_date", "user_id", "plan_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    plan_date: Mapped[date] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="planned", server_default="planned")
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"
    __table_args__ = (Index("ix_milestones_user_target", "user_id", "target_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    target_date: Mapped[date] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
