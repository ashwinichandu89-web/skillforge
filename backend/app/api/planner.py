from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Category, Milestone, StudyPlan, StudySession, User
from app.schemas.planner import (
    MilestoneIn, MilestoneOut, MilestoneUpdate, PlanIn, PlanOut, PlanUpdate, SessionIn, SessionOut, SessionUpdate,
)
from app.services import achievements
from app.services.common import get_category, get_visible_topic, not_found, user_today, week_start

router = APIRouter(tags=["planner"])


def _resolve_links(db: Session, user: User, topic_id: int | None, category_id: int | None) -> int | None:
    if topic_id is not None:
        return get_visible_topic(db, user, topic_id).category_id  # the topic decides the category
    if category_id is not None:
        get_category(db, category_id)
    return category_id


# ---------- study sessions (actual time) ----------

@router.post("/sessions", status_code=201, summary="Log a study session")
def create_session(body: SessionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_id = _resolve_links(db, user, body.topic_id, body.category_id)
    day = body.session_date or user_today(user)
    if day > user_today(user) + timedelta(days=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Study sessions cannot be logged in the future")
    s = StudySession(
        user_id=user.id, topic_id=body.topic_id, category_id=category_id, session_date=day,
        minutes=body.minutes, problems_solved=body.problems_solved, notes=body.notes,
    )
    db.add(s)
    db.flush()
    unlocked = achievements.evaluate(db, user)
    db.commit()
    return {"session": SessionOut.model_validate(s), "unlocked_achievements": achievements.serialize_unlocked(unlocked)}


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    start: date | None = None, end: date | None = None, topic_id: int | None = None, limit: int = 100,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    q = select(StudySession).where(StudySession.user_id == user.id)
    if start:
        q = q.where(StudySession.session_date >= start)
    if end:
        q = q.where(StudySession.session_date <= end)
    if topic_id is not None:
        q = q.where(StudySession.topic_id == topic_id)
    return list(db.scalars(q.order_by(StudySession.session_date.desc(), StudySession.id.desc()).limit(max(1, min(limit, 500)))))


def _own_session(db: Session, user: User, session_id: int) -> StudySession:
    s = db.scalar(select(StudySession).where(StudySession.id == session_id, StudySession.user_id == user.id))
    if s is None:
        raise not_found("Session")
    return s


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def update_session(session_id: int, body: SessionUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _own_session(db, user, session_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(s, k, v)
    db.commit()
    return s


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_session(db, user, session_id))
    db.commit()
    return Response(status_code=204)


# ---------- study plans (planned time) ----------

@router.post("/plans", response_model=PlanOut, status_code=201, summary="Add a planned study block")
def create_plan(body: PlanIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category_id = _resolve_links(db, user, body.topic_id, body.category_id)
    plan = StudyPlan(
        user_id=user.id, category_id=category_id, topic_id=body.topic_id, title=body.title.strip(),
        plan_date=body.plan_date, deadline=body.deadline, planned_minutes=body.planned_minutes, notes=body.notes,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _own_plan(db: Session, user: User, plan_id: int) -> StudyPlan:
    p = db.scalar(select(StudyPlan).where(StudyPlan.id == plan_id, StudyPlan.user_id == user.id))
    if p is None:
        raise not_found("Plan")
    return p


@router.patch("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, body: PlanUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = _own_plan(db, user, plan_id)
    data = body.model_dump(exclude_unset=True)
    if "topic_id" in data or "category_id" in data:
        topic_id = data.get("topic_id", plan.topic_id)
        plan.category_id = _resolve_links(db, user, topic_id, data.get("category_id", plan.category_id))
        plan.topic_id = topic_id
    for k in ("title", "plan_date", "planned_minutes", "deadline", "status", "notes"):
        if k in data and (data[k] is not None or k == "deadline"):
            setattr(plan, k, data[k])
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_plan(db, user, plan_id))
    db.commit()
    return Response(status_code=204)


@router.get("/planner/week", summary="One week of planned vs actual study time")
def planner_week(start: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = user_today(user)
    ws = week_start(start or today)
    we = ws + timedelta(days=6)

    plans = list(db.scalars(select(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.plan_date.between(ws, we)).order_by(StudyPlan.plan_date, StudyPlan.id)))
    sessions = list(db.scalars(select(StudySession).where(StudySession.user_id == user.id, StudySession.session_date.between(ws, we)).order_by(StudySession.session_date, StudySession.id)))

    days = []
    for i in range(7):
        d = ws + timedelta(days=i)
        day_plans = [p for p in plans if p.plan_date == d]
        day_sessions = [s for s in sessions if s.session_date == d]
        days.append({
            "date": d, "is_today": d == today,
            "planned_minutes": sum(p.planned_minutes for p in day_plans if p.status != "skipped"),
            "actual_minutes": sum(s.minutes for s in day_sessions),
            "plans": [PlanOut.model_validate(p) for p in day_plans],
            "sessions": [SessionOut.model_validate(s) for s in day_sessions],
        })

    cats = []
    for c in db.scalars(select(Category).order_by(Category.sort_order)):
        planned = sum(p.planned_minutes for p in plans if p.category_id == c.id and p.status != "skipped")
        actual = sum(s.minutes for s in sessions if s.category_id == c.id)
        cats.append({"category_id": c.id, "name": c.name, "color": c.color, "planned_minutes": planned, "actual_minutes": actual})

    upcoming = db.scalars(
        select(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.status == "planned", StudyPlan.plan_date >= today)
        .order_by(StudyPlan.plan_date, StudyPlan.id).limit(10))

    return {
        "week_start": ws, "week_end": we, "daily_goal_minutes": user.daily_goal_minutes,
        "totals": {"planned_minutes": sum(d["planned_minutes"] for d in days), "actual_minutes": sum(d["actual_minutes"] for d in days)},
        "days": days, "categories": cats,
        "upcoming": [PlanOut.model_validate(p) for p in upcoming],
    }


# ---------- milestones ----------

@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Milestone).where(Milestone.user_id == user.id).order_by(Milestone.target_date)))


@router.post("/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(body: MilestoneIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.category_id is not None:
        get_category(db, body.category_id)
    m = Milestone(user_id=user.id, **body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def _own_milestone(db: Session, user: User, mid: int) -> Milestone:
    m = db.scalar(select(Milestone).where(Milestone.id == mid, Milestone.user_id == user.id))
    if m is None:
        raise not_found("Milestone")
    return m


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(milestone_id: int, body: MilestoneUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    m = _own_milestone(db, user, milestone_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("category_id") is not None:
        get_category(db, data["category_id"])
    for k in ("title", "description", "target_date", "category_id"):
        if k in data and data[k] is not None:
            setattr(m, k, data[k])
    if "completed" in data and data["completed"] is not None:
        m.completed_at = datetime.now(timezone.utc) if data["completed"] else None
    db.commit()
    db.refresh(m)
    return m


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_milestone(db, user, milestone_id))
    db.commit()
    return Response(status_code=204)
