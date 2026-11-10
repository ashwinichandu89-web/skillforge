from sqlalchemy import JSON, CheckConstraint, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

DIFFICULTIES = ("beginner", "intermediate", "advanced")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40), default="book")
    color: Mapped[str] = mapped_column(String(16), default="#8b5cf6")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    topics: Mapped[list["Topic"]] = relationship(back_populates="category")


class Topic(Base, TimestampMixin):
    """Built-in topics have user_id NULL (shared, read-only). Custom topics belong to one user."""

    __tablename__ = "topics"
    __table_args__ = (
        CheckConstraint("difficulty IN ('beginner','intermediate','advanced')", name="difficulty_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(160))
    overview: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(16), default="beginner")
    estimated_hours: Mapped[float] = mapped_column(Float, default=10)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    concepts: Mapped[list] = mapped_column(JSON, default=list)
    recommended_resources: Mapped[list] = mapped_column(JSON, default=list)  # [{title,url,kind}]
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    mini_project: Mapped[str] = mapped_column(Text, default="")
    interview_questions: Mapped[list] = mapped_column(JSON, default=list)
    completion_criteria: Mapped[list] = mapped_column(JSON, default=list)

    category: Mapped[Category] = relationship(back_populates="topics")
    objectives: Mapped[list["TopicObjective"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan", order_by="TopicObjective.sort_order"
    )


class TopicObjective(Base):
    __tablename__ = "topic_objectives"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(String(300))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    topic: Mapped[Topic] = relationship(back_populates="objectives")
