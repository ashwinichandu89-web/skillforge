import type { ReactNode } from 'react';
import { DIFFICULTY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../../lib/format';
import type { Difficulty, Priority, Status } from '../../types';

/** All badges carry a text label, so meaning never depends on colour alone. */
export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

const STATUS_STYLE: Record<Status, string> = {
  not_started: 'bg-white/[0.07] text-ink-soft',
  in_progress: 'bg-brand-cyan/15 text-brand-cyan',
  completed: 'bg-brand-teal/15 text-brand-teal',
};
export const StatusBadge = ({ status }: { status: Status }) => <Chip className={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</Chip>;

const DIFF_STYLE: Record<Difficulty, string> = {
  beginner: 'bg-brand-teal/15 text-brand-teal',
  intermediate: 'bg-brand-orange/15 text-brand-orange',
  advanced: 'bg-violet-400/15 text-violet-300',
};
export const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => <Chip className={DIFF_STYLE[difficulty]}>{DIFFICULTY_LABEL[difficulty]}</Chip>;

const PRIO_STYLE: Record<Priority, string> = {
  low: 'bg-white/[0.07] text-ink-soft',
  medium: 'bg-brand-cyan/15 text-brand-cyan',
  high: 'bg-brand-orange/15 text-brand-orange',
};
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Chip className={PRIO_STYLE[priority]}>{PRIORITY_LABEL[priority]} priority</Chip>;
