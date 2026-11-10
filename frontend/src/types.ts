export type Status = 'not_started' | 'in_progress' | 'completed';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Priority = 'low' | 'medium' | 'high';
export type ResourceKind = 'youtube' | 'docs' | 'github' | 'course' | 'pdf' | 'reference';

export interface User { id: number; email: string; name: string; timezone: string; daily_goal_minutes: number }
export interface AuthResponse { access_token: string; refresh_token: string; user: User }

export interface TopicSummary {
  id: number; slug: string; category_id: number; is_custom: boolean;
  title: string; overview: string; difficulty: Difficulty; priority: Priority; status: Status;
  start_date: string | null; target_date: string | null; completed_date: string | null;
  estimated_hours: number; study_hours: number;
  objectives_total: number; objectives_done: number; progress_pct: number;
}

export interface RoadmapCategory {
  id: number; slug: string; name: string; description: string; icon: string; color: string;
  total: number; completed: number; in_progress: number; pct: number; topics: TopicSummary[];
}

export interface UnlockedAchievement { id: number; code: string; name: string; description: string; icon: string; xp: number }

export interface Note { id: number; content: string; created_at: string; updated_at: string }
export interface CatalogResource { title: string; url: string | null; kind: ResourceKind }
export interface UserResource {
  id: number; title: string; kind: ResourceKind; url: string | null; has_file?: boolean; filename: string | null; notes: string;
}
export interface SessionRow { id: number; session_date: string; minutes: number; problems_solved: number; notes: string }

export interface TopicDetail extends TopicSummary {
  category: { id: number; name: string; color: string; slug: string };
  concepts: string[]; recommended_resources: CatalogResource[];
  exercises: { index: number; text: string; done: boolean }[];
  mini_project: string; interview_questions: string[]; completion_criteria: string[];
  objectives: { id: number; text: string; done: boolean }[];
  notes: Note[]; resources: UserResource[]; sessions: SessionRow[];
  unlocked_achievements?: UnlockedAchievement[];
}

export interface LevelInfo { level: number; title: string; xp: number; xp_into_level: number; xp_for_next: number; progress: number }
export interface Streak { current: number; longest: number }
export interface Challenge { id: string; name: string; description: string; progress: number; target: number; done: boolean }

export interface FocusTopic extends TopicSummary { category_name?: string; category_color?: string }

export interface Overview {
  user: { name: string }; today: string; level: LevelInfo;
  totals: { topics: number; completed: number; in_progress: number; remaining: number; categories: number; completion_pct: number };
  streak: Streak; study_hours: number; today_minutes: number; daily_goal_minutes: number;
  weekly_activity: { date: string; minutes: number }[];
  monthly_progress: { month: string; completed: number; hours: number }[];
  recent_completed: FocusTopic[]; current_focus: FocusTopic[];
  upcoming_milestones: { id: number; title: string; description: string; target_date: string; category_id: number | null; days_left: number }[];
  weekly_challenges: Challenge[];
}

export interface CategoryStat { id: number; name: string; color: string; total: number; completed: number; in_progress: number; pct: number; hours: number }
export interface Analytics {
  completion_pct: number; completed: number; pending: number; total: number; in_progress: number;
  categories: CategoryStat[];
  weekly_hours: { week_start: string; hours: number }[];
  monthly_progress: { month: string; completed: number; hours: number }[];
  heatmap: { date: string; minutes: number; completions: number }[];
  streak: Streak; avg_completion_days: number | null;
  strongest_category: CategoryStat | null; weakest_category: CategoryStat | null;
}

export interface AchievementItem { id: number; code: string; name: string; description: string; icon: string; xp: number; unlocked: boolean; unlocked_at: string | null }
export interface AchievementsView {
  level: LevelInfo; streak: Streak; daily: { minutes: number; goal: number; done: boolean };
  weekly_challenges: Challenge[]; achievements: AchievementItem[];
}

export interface Plan {
  id: number; title: string; plan_date: string; planned_minutes: number; category_id: number | null;
  topic_id: number | null; deadline: string | null; status: 'planned' | 'done' | 'skipped'; notes: string;
}
export interface PlannerWeek {
  week_start: string; week_end: string; daily_goal_minutes: number;
  totals: { planned_minutes: number; actual_minutes: number };
  days: { date: string; is_today: boolean; planned_minutes: number; actual_minutes: number; plans: Plan[]; sessions: SessionRow[] }[];
  categories: { category_id: number; name: string; color: string; planned_minutes: number; actual_minutes: number }[];
  upcoming: Plan[];
}
export interface Milestone { id: number; title: string; description: string; target_date: string; category_id: number | null; completed_at: string | null }

export interface Resource {
  id: number; title: string; kind: ResourceKind; url: string | null; topic_id: number | null; category_id: number | null;
  notes: string; filename: string | null; has_file?: boolean; created_at: string;
}
