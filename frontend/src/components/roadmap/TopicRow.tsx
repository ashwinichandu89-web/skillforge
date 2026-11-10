import { Check, Pencil, Play, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtHours, localISO } from '../../lib/format';
import type { TopicSummary } from '../../types';
import { Chip, DifficultyBadge, PriorityBadge, StatusBadge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';

interface Props {
  topic: TopicSummary;
  /** Category colour, used for the thin progress bar. */
  color: string;
  /** True while any write is in flight; every action is disabled so nothing is double-submitted. */
  busy: boolean;
  onToggleComplete: (t: TopicSummary) => void;
  onStart: (t: TopicSummary) => void;
  onEdit: (t: TopicSummary) => void;
  onDelete: (t: TopicSummary) => void;
}

/**
 * One topic in the roadmap. The checkbox never changes anything by itself: it asks for confirmation first,
 * because a topic is only completed when the learner explicitly says so.
 */
export function TopicRow({ topic: t, color, busy, onToggleComplete, onStart, onEdit, onDelete }: Props) {
  const done = t.status === 'completed';
  const overdue = !!t.target_date && !done && t.target_date < localISO();

  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-1 gap-y-2 border-t border-white/[0.05] px-3 py-3 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-5">
      <button
        type="button" role="checkbox" aria-checked={done} aria-label={`Mark ${t.title} as completed`}
        title={done ? 'Completed. Click to reopen' : 'Mark as completed'}
        disabled={busy} onClick={() => onToggleComplete(t)}
        className="grid h-11 w-11 place-items-center rounded-xl transition hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 disabled:opacity-50"
      >
        <span className={`grid h-5 w-5 place-items-center rounded-md border-2 transition ${done ? 'border-brand-teal bg-brand-teal text-navy-950' : 'border-ink-mute'}`}>
          {done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
        </span>
      </button>

      <div className="min-w-0 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/topics/${t.id}`}
            className={`break-words rounded text-sm font-semibold hover:text-brand-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 ${done ? 'text-ink-soft' : ''}`}
          >
            {t.title}
          </Link>
          {t.is_custom && <Chip className="bg-brand-purple/15 text-violet-300">Custom</Chip>}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={t.status} />
          <DifficultyBadge difficulty={t.difficulty} />
          <span className="hidden sm:inline-flex"><PriorityBadge priority={t.priority} /></span>
        </div>

        <ProgressBar value={t.progress_pct} color={color} height="h-1" className="mt-2.5 max-w-xs" label={`${t.title} progress`} />

        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-mute">
          {t.objectives_total > 0 && <span>Objectives {t.objectives_done}/{t.objectives_total}</span>}
          <span>{fmtHours(t.study_hours)} of {fmtHours(t.estimated_hours)} studied</span>
          {t.start_date && <span className="hidden md:inline">Started {fmtDate(t.start_date)}</span>}
          {t.target_date && !done && (
            <span className={overdue ? 'font-semibold text-brand-orange' : ''}>
              Target {fmtDate(t.target_date)}{overdue ? ' (overdue)' : ''}
            </span>
          )}
          {done && t.completed_date && <span className="text-brand-teal">Completed {fmtDate(t.completed_date)}</span>}
        </p>
      </div>

      <div className="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-3 sm:row-start-1 sm:justify-end sm:pt-1">
        {t.status === 'not_started' && (
          <button type="button" className="btn-secondary min-h-[2.75rem] !px-3 text-xs" disabled={busy} onClick={() => onStart(t)}>
            <Play className="h-3.5 w-3.5" aria-hidden />Start learning
          </button>
        )}
        <button
          type="button" className="btn-ghost min-h-[2.75rem] min-w-[2.75rem] !px-2" disabled={busy}
          aria-label={`Edit ${t.title}`} title="Edit topic" onClick={() => onEdit(t)}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        {t.is_custom && (
          <button
            type="button" className="btn-ghost min-h-[2.75rem] min-w-[2.75rem] !px-2 hover:!text-red-300" disabled={busy}
            aria-label={`Delete ${t.title}`} title="Delete custom topic" onClick={() => onDelete(t)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
