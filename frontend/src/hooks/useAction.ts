import { useCallback, useRef, useState } from 'react';
import { invalidate } from '../api/cache';
import { useToast } from '../context/ToastContext';
import type { UnlockedAchievement } from '../types';

/** Query-key prefixes to refetch after a mutation. Keys: overview, roadmap, topic:<id>, analytics, achievements, planner:<week>, resources, milestones. */
export const AFTER_PROGRESS = ['topic', 'roadmap', 'overview', 'analytics', 'achievements'];
/** Logging or deleting study time also changes topic hours, planner actuals and streaks. */
export const AFTER_TIME = ['topic', 'roadmap', 'overview', 'analytics', 'achievements', 'planner'];

interface RunOptions<T> {
  success?: string;
  invalidate?: string[];
  onDone?: (result: T) => void;
}

/**
 * Runs one write against the API with a busy flag, error toast, cache invalidation and automatic
 * achievement toasts (any result carrying `unlocked_achievements` shows them).
 * Resolves to the result, or undefined when the request failed (the error has already been shown).
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async function runAction<T>(fn: () => Promise<T>, opts: RunOptions<T> = {}): Promise<T | undefined> {
    if (inFlight.current) return undefined; // ignore double clicks
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (opts.invalidate?.length) invalidate(...opts.invalidate);
      if (opts.success) toast.success(opts.success);
      const unlocked = (result as { unlocked_achievements?: UnlockedAchievement[] } | undefined)?.unlocked_achievements;
      if (unlocked?.length) toast.achievements(unlocked);
      opts.onDone?.(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(message);
      toast.error('Could not save', message);
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [toast]);

  return { busy, error, run };
}
