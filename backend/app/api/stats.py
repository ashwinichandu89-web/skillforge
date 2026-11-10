from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import analytics

router = APIRouter(tags=["stats"])


@router.get("/stats/overview", summary="Dashboard data: totals, streak, focus, milestones, challenges")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics.overview(db, user)


@router.get("/stats/analytics", summary="Analytics: category completion, weekly/monthly progress, heatmap")
def get_analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics.analytics(db, user)


@router.get("/achievements", summary="Level, XP, streak, daily goal, weekly challenges and all achievements")
def get_achievements(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics.achievements_view(db, user)
