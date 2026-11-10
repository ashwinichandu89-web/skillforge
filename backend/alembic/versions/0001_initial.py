"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-08
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

f = op.f  # mark names as final so the naming convention is not applied twice


def ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(64), server_default="UTC", nullable=False),
        sa.Column("daily_goal_minutes", sa.Integer(), server_default="60", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_users")),
        sa.CheckConstraint("daily_goal_minutes BETWEEN 5 AND 960", name=f("ck_users_daily_goal_range")),
    )
    op.create_index(f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=f("pk_refresh_tokens")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_refresh_tokens_user_id_users"), ondelete="CASCADE"),
        sa.UniqueConstraint("jti_hash", name=f("uq_refresh_tokens_jti_hash")),
    )
    op.create_index(f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"])

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(40), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_categories")),
        sa.UniqueConstraint("slug", name=f("uq_categories_slug")),
    )

    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("overview", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.String(16), nullable=False),
        sa.Column("estimated_hours", sa.Float(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("concepts", sa.JSON(), nullable=False),
        sa.Column("recommended_resources", sa.JSON(), nullable=False),
        sa.Column("exercises", sa.JSON(), nullable=False),
        sa.Column("mini_project", sa.Text(), nullable=False),
        sa.Column("interview_questions", sa.JSON(), nullable=False),
        sa.Column("completion_criteria", sa.JSON(), nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_topics")),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=f("fk_topics_category_id_categories"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_topics_user_id_users"), ondelete="CASCADE"),
        sa.UniqueConstraint("slug", name=f("uq_topics_slug")),
        sa.CheckConstraint("difficulty IN ('beginner','intermediate','advanced')", name=f("ck_topics_difficulty_valid")),
    )
    op.create_index(f("ix_topics_category_id"), "topics", ["category_id"])
    op.create_index(f("ix_topics_user_id"), "topics", ["user_id"])

    op.create_table(
        "topic_objectives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(300), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_topic_objectives")),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_topic_objectives_topic_id_topics"), ondelete="CASCADE"),
    )
    op.create_index(f("ix_topic_objectives_topic_id"), "topic_objectives", ["topic_id"])

    op.create_table(
        "user_topic_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), server_default="not_started", nullable=False),
        sa.Column("priority", sa.String(8), server_default="medium", nullable=False),
        sa.Column("difficulty", sa.String(16), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("completed_date", sa.Date(), nullable=True),
        sa.Column("exercises_done", sa.JSON(), nullable=False),
        sa.Column("title_override", sa.String(160), nullable=True),
        sa.Column("overview_override", sa.Text(), nullable=True),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_user_topic_progress")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_user_topic_progress_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_user_topic_progress_topic_id_topics"), ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "topic_id", name=f("uq_progress_user_topic")),
        sa.CheckConstraint("status IN ('not_started','in_progress','completed')", name=f("ck_user_topic_progress_status_valid")),
        sa.CheckConstraint("priority IN ('low','medium','high')", name=f("ck_user_topic_progress_priority_valid")),
        sa.CheckConstraint("difficulty IS NULL OR difficulty IN ('beginner','intermediate','advanced')", name=f("ck_user_topic_progress_difficulty_valid")),
    )
    op.create_index(f("ix_user_topic_progress_topic_id"), "user_topic_progress", ["topic_id"])
    op.create_index("ix_progress_user_status", "user_topic_progress", ["user_id", "status"])

    op.create_table(
        "user_objective_done",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("objective_id", sa.Integer(), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "objective_id", name=f("pk_user_objective_done")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_user_objective_done_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["objective_id"], ["topic_objectives.id"], name=f("fk_user_objective_done_objective_id_topic_objectives"), ondelete="CASCADE"),
    )
    op.create_index(f("ix_user_objective_done_objective_id"), "user_objective_done", ["objective_id"])

    op.create_table(
        "topic_status_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("from_status", sa.String(16), nullable=False),
        sa.Column("to_status", sa.String(16), nullable=False),
        sa.Column("xp", sa.Integer(), server_default="0", nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_topic_status_history")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_topic_status_history_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_topic_status_history_topic_id_topics"), ondelete="CASCADE"),
    )
    op.create_index(f("ix_topic_status_history_topic_id"), "topic_status_history", ["topic_id"])
    op.create_index("ix_history_user_date", "topic_status_history", ["user_id", "occurred_on"])

    op.create_table(
        "study_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("session_date", sa.Date(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("problems_solved", sa.Integer(), server_default="0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_study_sessions")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_study_sessions_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_study_sessions_topic_id_topics"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=f("fk_study_sessions_category_id_categories"), ondelete="SET NULL"),
        sa.CheckConstraint("minutes > 0 AND minutes <= 1440", name=f("ck_study_sessions_minutes_range")),
        sa.CheckConstraint("problems_solved >= 0", name=f("ck_study_sessions_problems_nonneg")),
    )
    op.create_index(f("ix_study_sessions_topic_id"), "study_sessions", ["topic_id"])
    op.create_index("ix_sessions_user_date", "study_sessions", ["user_id", "session_date"])

    op.create_table(
        "topic_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_topic_notes")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_topic_notes_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_topic_notes_topic_id_topics"), ondelete="CASCADE"),
    )
    op.create_index(f("ix_topic_notes_user_id"), "topic_notes", ["user_id"])
    op.create_index(f("ix_topic_notes_topic_id"), "topic_notes", ["topic_id"])

    op.create_table(
        "learning_resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("url", sa.String(1000), nullable=True),
        sa.Column("s3_key", sa.String(500), nullable=True),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_learning_resources")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_learning_resources_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_learning_resources_topic_id_topics"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=f("fk_learning_resources_category_id_categories"), ondelete="SET NULL"),
        sa.CheckConstraint("kind IN ('youtube','docs','github','course','pdf','reference')", name=f("ck_learning_resources_kind_valid")),
        sa.CheckConstraint("url IS NOT NULL OR s3_key IS NOT NULL OR notes <> ''", name=f("ck_learning_resources_has_content")),
    )
    op.create_index(f("ix_learning_resources_user_id"), "learning_resources", ["user_id"])
    op.create_index(f("ix_learning_resources_topic_id"), "learning_resources", ["topic_id"])
    op.create_index(f("ix_learning_resources_category_id"), "learning_resources", ["category_id"])

    op.create_table(
        "achievements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("icon", sa.String(40), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("rule_type", sa.String(32), nullable=False),
        sa.Column("rule_value", sa.Integer(), nullable=False),
        sa.Column("rule_data", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_achievements")),
        sa.UniqueConstraint("code", name=f("uq_achievements_code")),
    )

    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("achievement_id", sa.Integer(), nullable=False),
        sa.Column("xp_awarded", sa.Integer(), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=f("pk_user_achievements")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_user_achievements_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"], name=f("fk_user_achievements_achievement_id_achievements"), ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "achievement_id", name=f("uq_user_achievement")),
    )
    op.create_index(f("ix_user_achievements_user_id"), "user_achievements", ["user_id"])

    op.create_table(
        "study_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("planned_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), server_default="planned", nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_study_plans")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_study_plans_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=f("fk_study_plans_category_id_categories"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], name=f("fk_study_plans_topic_id_topics"), ondelete="SET NULL"),
        sa.CheckConstraint("planned_minutes > 0 AND planned_minutes <= 1440", name=f("ck_study_plans_planned_range")),
        sa.CheckConstraint("status IN ('planned','done','skipped')", name=f("ck_study_plans_status_valid")),
    )
    op.create_index("ix_plans_user_date", "study_plans", ["user_id", "plan_date"])

    op.create_table(
        "milestones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *ts(),
        sa.PrimaryKeyConstraint("id", name=f("pk_milestones")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=f("fk_milestones_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=f("fk_milestones_category_id_categories"), ondelete="SET NULL"),
    )
    op.create_index("ix_milestones_user_target", "milestones", ["user_id", "target_date"])


def downgrade() -> None:
    for table in (
        "milestones", "study_plans", "user_achievements", "achievements", "learning_resources",
        "topic_notes", "study_sessions", "topic_status_history", "user_objective_done",
        "user_topic_progress", "topic_objectives", "topics", "categories", "refresh_tokens", "users",
    ):
        op.drop_table(table)
