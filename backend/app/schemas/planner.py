from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SessionIn(BaseModel):
    topic_id: int | None = None
    category_id: int | None = None
    session_date: date | None = None  # defaults to today in the user's timezone
    minutes: int = Field(gt=0, le=1440)
    problems_solved: int = Field(default=0, ge=0, le=1000)
    notes: str = Field(default="", max_length=2000)


class SessionUpdate(BaseModel):
    session_date: date | None = None
    minutes: int | None = Field(default=None, gt=0, le=1440)
    problems_solved: int | None = Field(default=None, ge=0, le=1000)
    notes: str | None = Field(default=None, max_length=2000)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    topic_id: int | None
    category_id: int | None
    session_date: date
    minutes: int
    problems_solved: int
    notes: str


class PlanIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    plan_date: date
    planned_minutes: int = Field(gt=0, le=1440)
    category_id: int | None = None
    topic_id: int | None = None
    deadline: date | None = None
    notes: str = Field(default="", max_length=2000)


class PlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    plan_date: date | None = None
    planned_minutes: int | None = Field(default=None, gt=0, le=1440)
    category_id: int | None = None
    topic_id: int | None = None
    deadline: date | None = None
    status: Literal["planned", "done", "skipped"] | None = None
    notes: str | None = Field(default=None, max_length=2000)


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    plan_date: date
    planned_minutes: int
    category_id: int | None
    topic_id: int | None
    deadline: date | None
    status: str
    notes: str


class MilestoneIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    target_date: date
    category_id: int | None = None


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    target_date: date | None = None
    category_id: int | None = None
    completed: bool | None = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    target_date: date
    category_id: int | None
    completed_at: datetime | None
