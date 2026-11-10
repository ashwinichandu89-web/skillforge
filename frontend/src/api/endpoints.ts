import { http, qs } from './client';
import type {
  AuthResponse, Analytics, AchievementsView, Milestone, Overview, Plan, PlannerWeek, Resource,
  RoadmapCategory, SessionRow, TopicDetail, User, UnlockedAchievement, Note,
} from '../types';

export const api = {
  auth: {
    register: (b: { email: string; name: string; password: string; timezone: string }) => http.post<AuthResponse>('/auth/register', b),
    login: (b: { email: string; password: string }) => http.post<AuthResponse>('/auth/login', b),
    logout: (refresh_token: string) => http.post<void>('/auth/logout', { refresh_token }),
    me: () => http.get<User>('/auth/me'),
    update: (b: Partial<Pick<User, 'name' | 'timezone' | 'daily_goal_minutes'>>) => http.patch<User>('/auth/me', b),
    changePassword: (b: { current_password: string; new_password: string }) => http.post<void>('/auth/change-password', b),
  },
  roadmap: () => http.get<RoadmapCategory[]>('/roadmap'),
  overview: () => http.get<Overview>('/stats/overview'),
  analytics: () => http.get<Analytics>('/stats/analytics'),
  achievements: () => http.get<AchievementsView>('/achievements'),

  topics: {
    get: (id: number) => http.get<TopicDetail>(`/topics/${id}`),
    create: (b: {
      category_id: number; title: string; overview?: string; difficulty?: string; priority?: string;
      estimated_hours?: number; target_date?: string | null; objectives?: string[];
    }) => http.post<TopicDetail>('/topics', b),
    update: (id: number, b: Record<string, unknown>) => http.patch<TopicDetail>(`/topics/${id}`, b),
    remove: (id: number) => http.del(`/topics/${id}`),
    start: (id: number) => http.post<TopicDetail>(`/topics/${id}/start`),
    complete: (id: number, completed_date?: string) => http.post<TopicDetail>(`/topics/${id}/complete`, { confirm: true, completed_date }),
    reopen: (id: number) => http.post<TopicDetail>(`/topics/${id}/reopen`),
    setObjective: (id: number, objectiveId: number, done: boolean) => http.put<TopicDetail>(`/topics/${id}/objectives/${objectiveId}`, { done }),
    addObjective: (id: number, text: string) => http.post<TopicDetail>(`/topics/${id}/objectives`, { text }),
    removeObjective: (id: number, objectiveId: number) => http.del<TopicDetail>(`/topics/${id}/objectives/${objectiveId}`),
    setExercise: (id: number, index: number, done: boolean) => http.put<TopicDetail>(`/topics/${id}/exercises/${index}`, { done }),
    addNote: (id: number, content: string) => http.post<Note>(`/topics/${id}/notes`, { content }),
  },
  notes: {
    update: (id: number, content: string) => http.put<Note>(`/notes/${id}`, { content }),
    remove: (id: number) => http.del(`/notes/${id}`),
  },

  sessions: {
    create: (b: { topic_id?: number | null; category_id?: number | null; session_date?: string; minutes: number; problems_solved?: number; notes?: string }) =>
      http.post<{ session: SessionRow; unlocked_achievements: UnlockedAchievement[] }>('/sessions', b),
    remove: (id: number) => http.del(`/sessions/${id}`),
  },
  plans: {
    create: (b: Partial<Plan> & { title: string; plan_date: string; planned_minutes: number }) => http.post<Plan>('/plans', b),
    update: (id: number, b: Partial<Plan>) => http.patch<Plan>(`/plans/${id}`, b),
    remove: (id: number) => http.del(`/plans/${id}`),
    week: (start?: string) => http.get<PlannerWeek>(`/planner/week${qs({ start })}`),
  },
  milestones: {
    list: () => http.get<Milestone[]>('/milestones'),
    create: (b: { title: string; description?: string; target_date: string; category_id?: number | null }) => http.post<Milestone>('/milestones', b),
    update: (id: number, b: Record<string, unknown>) => http.patch<Milestone>(`/milestones/${id}`, b),
    remove: (id: number) => http.del(`/milestones/${id}`),
  },
  resources: {
    list: (f: { category_id?: number | null; topic_id?: number | null; kind?: string; q?: string }) => http.get<Resource[]>(`/resources${qs(f)}`),
    create: (b: Record<string, unknown>) => http.post<Resource>('/resources', b),
    update: (id: number, b: Record<string, unknown>) => http.patch<Resource>(`/resources/${id}`, b),
    remove: (id: number) => http.del(`/resources/${id}`),
    uploadUrl: (filename: string) => http.post<{ s3_key: string; filename: string; url: string; fields: Record<string, string>; max_bytes: number }>('/resources/upload-url', { filename, content_type: 'application/pdf' }),
    downloadUrl: (id: number) => http.get<{ url: string }>(`/resources/${id}/download-url`),
  },
};
