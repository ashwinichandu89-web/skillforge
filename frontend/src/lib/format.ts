export function localISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date (new Date('2026-01-05') would be UTC and can shift a day). */
export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const fmtDate = (s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  s ? parseISO(s).toLocaleDateString(undefined, opts) : '—';

export const fmtShort = (s: string) => fmtDate(s, { day: 'numeric', month: 'short' });
export const fmtWeekday = (s: string) => fmtDate(s, { weekday: 'short' });

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' } as const;
export const DIFFICULTY_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;
export const KIND_LABEL = { youtube: 'YouTube', docs: 'Documentation', github: 'GitHub', course: 'Course', pdf: 'PDF', reference: 'Reference' } as const;

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

/** Monday of the week containing `iso` (the API's weeks start on Monday). */
export function mondayOf(iso: string): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localISO(d);
}

export const fmtHours = (h: number) => `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;

/** "today", "tomorrow", "in 5 days", "3 days ago" for a whole-day difference. */
export function relativeDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
