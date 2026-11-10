import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Topic, TopicNote, TopicObjective, User
from app.schemas.content import (
    CompleteIn, ExerciseDoneIn, NoteIn, NoteOut, ObjectiveCreate, ObjectiveDoneIn, TopicCreate, TopicUpdate,
)
from app.services import achievements, progress, topic_views
from app.services.common import get_category, get_visible_topic, not_found

router = APIRouter(tags=["topics"])


def _slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50] or "topic"
    return f"custom-{base}-{uuid.uuid4().hex[:8]}"


def _result(db: Session, user: User, topic: Topic, unlocked=None) -> dict:
    data = topic_views.topic_detail(db, user, topic)
    data["unlocked_achievements"] = achievements.serialize_unlocked(unlocked or [])
    return data


def _own_custom_topic(db: Session, user: User, topic_id: int) -> Topic:
    topic = get_visible_topic(db, user, topic_id)
    if topic.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Built-in topics cannot be changed. Only your personal settings for them can.")
    return topic


@router.get("/roadmap", summary="All categories with their topics and this user's progress")
def get_roadmap(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return topic_views.roadmap(db, user)


@router.post("/topics", status_code=201, summary="Create a custom topic")
def create_topic(body: TopicCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_category(db, body.category_id)
    topic = Topic(
        category_id=body.category_id, user_id=user.id, slug=_slugify(body.title), title=body.title,
        overview=body.overview, difficulty=body.difficulty, estimated_hours=body.estimated_hours,
        sort_order=0, concepts=[], recommended_resources=[], exercises=[], interview_questions=[],
        completion_criteria=[], mini_project="",
    )
    topic.objectives = [TopicObjective(text=t, sort_order=i) for i, t in enumerate(body.objectives)]
    db.add(topic)
    db.flush()
    p = progress.get_progress(db, user, topic)
    p.priority = body.priority
    p.target_date = body.target_date
    db.commit()
    return _result(db, user, topic)


@router.get("/topics/{topic_id}", summary="Full topic workspace data")
def get_topic(topic_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return topic_views.topic_detail(db, user, get_visible_topic(db, user, topic_id))


@router.patch("/topics/{topic_id}", summary="Edit a topic (custom topics fully; built-in topics per user)")
def update_topic(topic_id: int, body: TopicUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    p = progress.get_progress(db, user, topic)
    data = body.model_dump(exclude_unset=True)
    is_custom = topic.user_id == user.id

    if "priority" in data and data["priority"]:
        p.priority = data["priority"]
    if "start_date" in data and data["start_date"]:
        p.start_date = data["start_date"]
    if data.get("clear_start_date"):
        p.start_date = None
    if "target_date" in data and data["target_date"]:
        p.target_date = data["target_date"]
    if data.get("clear_target_date"):
        p.target_date = None

    for field in ("title", "overview", "difficulty"):
        value = data.get(field)
        if value is None:
            continue
        if field == "title":
            value = value.strip()
            if not value:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Title cannot be empty")
        if is_custom:
            setattr(topic, field, value)
        elif field == "title":
            p.title_override = value
        elif field == "overview":
            p.overview_override = value
        else:
            p.difficulty = value
    if data.get("estimated_hours") is not None and is_custom:
        topic.estimated_hours = data["estimated_hours"]
    db.commit()
    return _result(db, user, topic)


@router.delete("/topics/{topic_id}", status_code=204, summary="Delete a custom topic")
def delete_topic(topic_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = _own_custom_topic(db, user, topic_id)
    db.delete(topic)
    db.commit()
    return Response(status_code=204)


@router.post("/topics/{topic_id}/start", summary="Start learning")
def start(topic_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    progress.start_topic(db, user, topic)
    db.commit()
    return _result(db, user, topic)


@router.post("/topics/{topic_id}/complete", summary="Mark as completed (requires explicit confirmation)")
def complete(topic_id: int, body: CompleteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not body.confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Completion must be explicitly confirmed (confirm: true)")
    topic = get_visible_topic(db, user, topic_id)
    progress.complete_topic(db, user, topic, body.completed_date)
    unlocked = achievements.evaluate(db, user)
    db.commit()
    return _result(db, user, topic, unlocked)


@router.post("/topics/{topic_id}/reopen", summary="Reopen a completed topic")
def reopen(topic_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    progress.reopen_topic(db, user, topic)
    db.commit()
    return _result(db, user, topic)


@router.put("/topics/{topic_id}/objectives/{objective_id}", summary="Tick or untick a learning objective")
def set_objective(topic_id: int, objective_id: int, body: ObjectiveDoneIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    objective = db.scalar(select(TopicObjective).where(TopicObjective.id == objective_id, TopicObjective.topic_id == topic.id))
    if objective is None:
        raise not_found("Objective")
    progress.set_objective_done(db, user, topic, objective, body.done)
    unlocked = achievements.evaluate(db, user)
    db.commit()
    return _result(db, user, topic, unlocked)


@router.post("/topics/{topic_id}/objectives", status_code=201, summary="Add an objective to a custom topic")
def add_objective(topic_id: int, body: ObjectiveCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = _own_custom_topic(db, user, topic_id)
    topic.objectives.append(TopicObjective(text=body.text.strip(), sort_order=len(topic.objectives)))
    db.commit()
    return _result(db, user, topic)


@router.delete("/topics/{topic_id}/objectives/{objective_id}", summary="Remove an objective from a custom topic")
def delete_objective(topic_id: int, objective_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = _own_custom_topic(db, user, topic_id)
    objective = db.scalar(select(TopicObjective).where(TopicObjective.id == objective_id, TopicObjective.topic_id == topic.id))
    if objective is None:
        raise not_found("Objective")
    db.delete(objective)
    db.commit()
    db.refresh(topic)
    return _result(db, user, topic)


@router.put("/topics/{topic_id}/exercises/{index}", summary="Tick or untick a practical exercise")
def set_exercise(topic_id: int, index: int, body: ExerciseDoneIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    if index < 0 or index >= len(topic.exercises or []):
        raise not_found("Exercise")
    p = progress.get_progress(db, user, topic)
    done = set(p.exercises_done or [])
    done.add(index) if body.done else done.discard(index)
    p.exercises_done = sorted(done)  # reassign so the JSON change is detected
    db.commit()
    return _result(db, user, topic)


@router.get("/topics/{topic_id}/notes", response_model=list[NoteOut])
def list_notes(topic_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    return list(db.scalars(select(TopicNote).where(TopicNote.user_id == user.id, TopicNote.topic_id == topic.id).order_by(TopicNote.created_at.desc())))


@router.post("/topics/{topic_id}/notes", response_model=NoteOut, status_code=201)
def add_note(topic_id: int, body: NoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topic = get_visible_topic(db, user, topic_id)
    note = TopicNote(user_id=user.id, topic_id=topic.id, content=body.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def _own_note(db: Session, user: User, note_id: int) -> TopicNote:
    note = db.scalar(select(TopicNote).where(TopicNote.id == note_id, TopicNote.user_id == user.id))
    if note is None:
        raise not_found("Note")
    return note


@router.put("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, body: NoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = _own_note(db, user, note_id)
    note.content = body.content
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_note(db, user, note_id))
    db.commit()
    return Response(status_code=204)
