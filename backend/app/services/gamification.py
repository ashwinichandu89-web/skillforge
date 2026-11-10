"""Pure gamification maths: XP, levels, streaks, weekly challenges.

No database access here so every rule is unit-testable.
"""
from datetime import date, timedelta

XP_BY_DIFFICULTY = {"beginner": 50, "intermediate": 100, "advanced": 150}
XP_PER_OBJECTIVE = 10

LEVEL_TITLES = [
    "Apprentice", "Explorer", "Builder", "Practitioner", "Specialist",
    "Engineer", "Senior Engineer", "Architect", "Principal", "Solution Engineer",
]


def topic_xp(difficulty: str) -> int:
    return XP_BY_DIFFICULTY.get(difficulty, XP_BY_DIFFICULTY["intermediate"])


def xp_required_for_level(level: int) -> int:
    """Cumulative XP needed to reach `level` (level 1 = 0 XP).

    Step from level n to n+1 is 100 + 50*(n-1): 100, 150, 200, ...
    """
    n = max(level, 1) - 1
    return 100 * n + 25 * n * (n - 1)


def level_info(xp: int) -> dict:
    xp = max(int(xp), 0)
    level = 1
    while xp >= xp_required_for_level(level + 1):
        level += 1
    floor = xp_required_for_level(level)
    ceiling = xp_required_for_level(level + 1)
    return {
        "level": level,
        "title": LEVEL_TITLES[min(level - 1, len(LEVEL_TITLES) - 1)],
        "xp": xp,
        "xp_into_level": xp - floor,
        "xp_for_next": ceiling - floor,
        "progress": (xp - floor) / (ceiling - floor),
    }


def compute_streaks(active_dates: set[date], today: date) -> dict:
    """Current streak counts back from today, or from yesterday if today has no
    activity yet (so the streak is not lost until a full day is missed)."""
    if not active_dates:
        return {"current": 0, "longest": 0}

    cursor = today if today in active_dates else today - timedelta(days=1)
    current = 0
    while cursor in active_dates:
        current += 1
        cursor -= timedelta(days=1)

    longest = run = 0
    prev = None
    for d in sorted(active_dates):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    return {"current": current, "longest": max(longest, current)}


def weekly_challenges(minutes: int, active_days: int, topics_completed: int, objectives_done: int) -> list[dict]:
    """Challenges are derived from this week's real activity, never stored.
    They are goals, not XP sources: XP comes only from stored events."""
    defs = [
        ("study_5h", "Focus week", "Study for 5 hours this week", minutes, 300),
        ("active_4d", "Consistency", "Study on 4 different days", active_days, 4),
        ("objectives_5", "Step by step", "Tick off 5 learning objectives", objectives_done, 5),
        ("complete_1", "Finisher", "Complete a topic this week", topics_completed, 1),
    ]
    return [
        {
            "id": cid, "name": name, "description": desc,
            "progress": min(value, target), "target": target,
            "done": value >= target,
        }
        for cid, name, desc, value, target in defs
    ]
