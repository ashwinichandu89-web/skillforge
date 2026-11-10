from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

Difficulty = Literal["beginner", "intermediate", "advanced"]
Priority = Literal["low", "medium", "high"]
ResourceKind = Literal["youtube", "docs", "github", "course", "pdf", "reference"]


class TopicCreate(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=160)
    overview: str = Field(default="", max_length=5000)
    difficulty: Difficulty = "beginner"
    priority: Priority = "medium"
    estimated_hours: float = Field(default=10, ge=0, le=1000)
    target_date: date | None = None
    objectives: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        return v

    @field_validator("objectives")
    @classmethod
    def _objectives(cls, v: list[str]) -> list[str]:
        cleaned = [o.strip() for o in v if o.strip()]
        if any(len(o) > 300 for o in cleaned):
            raise ValueError("Objectives must be 300 characters or fewer")
        return cleaned


class TopicUpdate(BaseModel):
    """Every field is optional. For built-in topics, title/overview/difficulty are stored as
    this user's own overrides; the shared catalog is never modified."""
    title: str | None = Field(default=None, min_length=1, max_length=160)
    overview: str | None = Field(default=None, max_length=5000)
    difficulty: Difficulty | None = None
    priority: Priority | None = None
    start_date: date | None = None
    target_date: date | None = None
    estimated_hours: float | None = Field(default=None, ge=0, le=1000)
    clear_target_date: bool = False
    clear_start_date: bool = False


class CompleteIn(BaseModel):
    confirm: bool = Field(description="Must be true. Completion is never automatic.")
    completed_date: date | None = None


class ObjectiveDoneIn(BaseModel):
    done: bool


class ObjectiveCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class ExerciseDoneIn(BaseModel):
    done: bool


class NoteIn(BaseModel):
    content: str = Field(min_length=1, max_length=10000)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    topic_id: int
    content: str
    created_at: datetime
    updated_at: datetime


def _http_url(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = v.strip()
    if not (v.startswith("https://") or v.startswith("http://")) or len(v) > 1000 or " " in v:
        raise ValueError("URL must start with http:// or https:// and contain no spaces")
    return v


class ResourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: ResourceKind
    url: str | None = None
    topic_id: int | None = None
    category_id: int | None = None
    notes: str = Field(default="", max_length=5000)
    s3_key: str | None = Field(default=None, max_length=500)
    filename: str | None = Field(default=None, max_length=255)

    _url = field_validator("url")(_http_url)


class ResourceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: ResourceKind | None = None
    url: str | None = None
    topic_id: int | None = None
    category_id: int | None = None
    notes: str | None = Field(default=None, max_length=5000)

    _url = field_validator("url")(_http_url)


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    kind: str
    url: str | None
    topic_id: int | None
    category_id: int | None
    notes: str
    filename: str | None
    s3_key: str | None = Field(default=None, exclude=True)  # internal; never sent to clients
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_file(self) -> bool:
        return bool(self.s3_key)


class UploadUrlIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: Literal["application/pdf"] = "application/pdf"
