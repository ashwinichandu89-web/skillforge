"""Dashboard and analytics aggregation. Nothing here is stored or hard-coded: every
number is computed from the user's rows at request time."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Milestone, StudySession, User, UserAchievement
from app.services import activity, progress as progress_svc, topic_views
from app.services.common import user_today, week_start
from app.services.gamification import level_info, weekly_challenges


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _last_months(today: date, n: int) -> list[str]:
    y, m = today.year, today.month
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _focus_rank(item: dict) -> tuple:
    prio = {"high": 0, "medium": 1, "low": 2}[item["priority"]]
    return (prio,)


def overview(db: Session, user: User) -> dict:
    today = user_today(user)
    rm = topic_views.roadmap(db, user)
    all_topics = [t for c in rm for t in c["topics"]]
    total = len(all_topics)
    completed = [t for t in all_topics if t["status"] == "completed"]
    in_progress = [t for t in all_topics if t["status"] == "in_progress"]

    mins = activity.minutes_by_day(db, user, since=today - timedelta(days=370))
    comps = activity.completions_by_day(db, user, since=today - timedelta(days=370))
    st = activity.streaks(db, user)
    xp = progress_svc.total_xp(db, user)

    # Current focus: topics in progress (highest priority first), else the next suggested topic.
    focus = sorted(in_progress, key=_focus_rank)[:3]
    if not focus:
        pending = [t for t in all_topics if t["status"] == "not_started"]
        focus = sorted(pending, key=_focus_rank)[:1]
    cat_names = {c["id"]: c["name"] for c in rm}
    cat_colors = {c["id"]: c["color"] for c in rm}

    monthly = {k: {"month": k, "completed": 0, "hours": 0.0} for k in _last_months(today, 6)}
    for t in completed:
        if t["completed_date"] and _month_key(t["completed_date"]) in monthly:
            monthly[_month_key(t["completed_date"])]["completed"] += 1
    for d, m in mins.items():
        if _month_key(d) in monthly:
            monthly[_month_key(d)]["hours"] += m / 60
    for v in monthly.values():
        v["hours"] = round(v["hours"], 1)

    ws = week_start(today)
    week_days = [ws + timedelta(days=i) for i in range(7)]
    week_minutes = sum(mins.get(d, 0) for d in week_days)
    week_objectives = activity.objective_days(db, user, since=ws)
    challenges = weekly_challenges(
        minutes=week_minutes,
        active_days=sum(1 for d in week_days if mins.get(d) or comps.get(d) or week_objectives.get(d)),
        topics_completed=sum(comps.get(d, 0) for d in week_days),
        objectives_done=sum(week_objectives.values()),
    )

    milestones = db.scalars(
        select(Milestone).where(Milestone.user_id == user.id, Milestone.completed_at.is_(None))
        .order_by(Milestone.target_date).limit(4))

    def with_cat(t):
        return {**t, "category_name": cat_names.get(t["category_id"]), "category_color": cat_colors.get(t["category_id"])}

    return {
        "user": {"name": user.name},
        "today": today,
        "level": level_info(xp),
        "totals": {
            "topics": total, "completed": len(completed), "in_progress": len(in_progress),
            "remaining": total - len(completed), "categories": len(rm),
            "completion_pct": round(100 * len(completed) / total) if total else 0,
        },
        "streak": st,
        "study_hours": round(activity.total_minutes(db, user) / 60, 1),
        "today_minutes": mins.get(today, 0),
        "daily_goal_minutes": user.daily_goal_minutes,
        "weekly_activity": [{"date": d, "minutes": mins.get(d, 0)} for d in activity.last_n_days(today, 7)],
        "monthly_progress": list(monthly.values()),
        "recent_completed": [with_cat(t) for t in sorted(completed, key=lambda t: (t["completed_date"] or date.min), reverse=True)[:5]],
        "current_focus": [with_cat(t) for t in focus],
        "upcoming_milestones": [
            {"id": m.id, "title": m.title, "description": m.description, "target_date": m.target_date,
             "category_id": m.category_id, "days_left": (m.target_date - today).days}
            for m in milestones],
        "weekly_challenges": challenges,
    }


def analytics(db: Session, user: User) -> dict:
    today = user_today(user)
    rm = topic_views.roadmap(db, user)
    all_topics = [t for c in rm for t in c["topics"]]
    total = len(all_topics)
    completed = [t for t in all_topics if t["status"] == "completed"]

    since = today - timedelta(days=364)
    mins = activity.minutes_by_day(db, user, since=since - timedelta(days=60))
    comps = activity.completions_by_day(db, user, since=since)

    cat_minutes: dict[int, int] = {}
    for cid, m in db.execute(
        select(StudySession.category_id, StudySession.minutes).where(StudySession.user_id == user.id, StudySession.category_id.is_not(None))
    ):
        cat_minutes[cid] = cat_minutes.get(cid, 0) + m

    categories = [{
        "id": c["id"], "name": c["name"], "color": c["color"], "total": c["total"], "completed": c["completed"],
        "in_progress": c["in_progress"], "pct": c["pct"], "hours": round(cat_minutes.get(c["id"], 0) / 60, 1),
    } for c in rm]

    ws = week_start(today)
    weekly = []
    for i in range(7, -1, -1):
        start = ws - timedelta(days=7 * i)
        m = sum(mins.get(start + timedelta(days=k), 0) for k in range(7))
        weekly.append({"week_start": start, "hours": round(m / 60, 1)})

    months = {k: {"month": k, "completed": 0, "hours": 0.0} for k in _last_months(today, 12)}
    for t in completed:
        if t["completed_date"] and _month_key(t["completed_date"]) in months:
            months[_month_key(t["completed_date"])]["completed"] += 1
    for d, m in mins.items():
        if _month_key(d) in months:
            months[_month_key(d)]["hours"] += m / 60
    for v in months.values():
        v["hours"] = round(v["hours"], 1)

    heatmap = []
    d = since
    while d <= today:
        heatmap.append({"date": d, "minutes": mins.get(d, 0), "completions": comps.get(d, 0)})
        d += timedelta(days=1)

    durations = [(t["completed_date"] - t["start_date"]).days for t in completed if t["start_date"] and t["completed_date"]]
    ranked = [c for c in categories if c["total"] > 0]
    ranked.sort(key=lambda c: (c["pct"], c["hours"]))
    strongest = ranked[-1] if ranked and ranked[-1]["pct"] > 0 else None
    weakest = ranked[0] if ranked else None

    return {
        "completion_pct": round(100 * len(completed) / total) if total else 0,
        "completed": len(completed), "pending": total - len(completed), "total": total,
        "in_progress": sum(1 for t in all_topics if t["status"] == "in_progress"),
        "categories": categories,
        "weekly_hours": weekly,
        "monthly_progress": list(months.values()),
        "heatmap": heatmap,
        "streak": activity.streaks(db, user),
        "avg_completion_days": round(sum(durations) / len(durations), 1) if durations else None,
        "strongest_category": strongest,
        "weakest_category": weakest,
    }


def achievements_view(db: Session, user: User) -> dict:
    from app.models import Achievement

    unlocked = {ua.achievement_id: ua for ua in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))}
    items = [{
        "id": a.id, "code": a.code, "name": a.name, "description": a.description, "icon": a.icon, "xp": a.xp,
        "unlocked": a.id in unlocked, "unlocked_at": unlocked[a.id].unlocked_at if a.id in unlocked else None,
    } for a in db.scalars(select(Achievement).order_by(Achievement.sort_order))]
    ov = overview(db, user)
    return {
        "level": ov["level"], "streak": ov["streak"],
        "daily": {"minutes": ov["today_minutes"], "goal": user.daily_goal_minutes,
                  "done": ov["today_minutes"] >= user.daily_goal_minutes},
        "weekly_challenges": ov["weekly_challenges"],
        "achievements": items,
    }
