import { api } from '../api/endpoints';
import type { RoadmapCategory, TopicSummary } from '../types';
import { useQuery } from './useQuery';

/** The roadmap (categories + every visible topic with this user's progress). Query key: 'roadmap'. */
export const useRoadmap = () => useQuery<RoadmapCategory[]>('roadmap', api.roadmap);

/** Same data, but only fetched while `enabled` (used by modals so a closed dialog costs no request). */
export const useRoadmapWhen = (enabled: boolean) => useQuery<RoadmapCategory[]>(enabled ? 'roadmap' : null, api.roadmap);

export const flattenTopics =(rm: RoadmapCategory[] | undefined): TopicSummary[] => (rm ?? []).flatMap((c) => c.topics);

/** The category holding Problem Solver style DSA practice. Matches the backend's DSA_CATEGORY_SLUG. */
export const DSA_SLUG = 'programming-dsa';

/** Remembers the last opened topic so "Topic Workspace" in the sidebar can resume it. A convenience only. */
const LAST = 'sf:lastTopic';
export const getLastTopic = (): number | null => {
  try { const v = Number(localStorage.getItem(LAST)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
};
export const setLastTopic = (id: number) => { try { localStorage.setItem(LAST, String(id)); } catch { /* ignore */ } };
