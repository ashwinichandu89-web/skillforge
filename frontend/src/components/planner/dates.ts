import { localISO, parseISO } from '../../lib/format';

/** Whole days from today (the browser's local date) to `iso`. Negative = in the past. */
export function daysFromToday(iso: string): number {
  return Math.round((parseISO(iso).getTime() - parseISO(localISO()).getTime()) / 86_400_000);
}
