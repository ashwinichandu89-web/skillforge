import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import type { RoadmapCategory, TopicSummary } from '../../types';
import { NamedIcon } from '../icons';
import { ProgressBar } from '../ui/ProgressBar';
import { TopicRow } from './TopicRow';

interface Props {
  category: RoadmapCategory;
  /** The topics to list (already filtered). The header numbers always describe the whole category. */
  topics: TopicSummary[];
  open: boolean;
  filtering: boolean;
  busy: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onToggleComplete: (t: TopicSummary) => void;
  onStart: (t: TopicSummary) => void;
  onEdit: (t: TopicSummary) => void;
  onDelete: (t: TopicSummary) => void;
}

/** An expandable category: header with progress, then its topic list. */
export function CategoryCard({ category: c, topics, open, filtering, busy, onToggle, onAdd, onToggleComplete, onStart, onEdit, onDelete }: Props) {
  const reduce = useReducedMotion();
  const panelId = `category-panel-${c.id}`;
  const pct = Math.round(c.pct);

  return (
    <section className="card overflow-hidden" aria-label={c.name}>
      <div className="flex items-center gap-1 pr-2 sm:pr-3">
        <button
          type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-cyan/60 sm:p-5"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${c.color}26`, color: c.color }} aria-hidden>
            <NamedIcon name={c.icon} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="h-display block truncate text-base sm:text-lg">{c.name}</span>
            <span className="hidden truncate text-xs text-ink-mute sm:block">{c.description}</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              {c.completed}/{c.total} completed
              {c.in_progress > 0 && <> · {c.in_progress} in progress</>}
              {filtering && <> · showing {topics.length}</>}
            </span>
          </span>
          <span className="h-display shrink-0 text-lg tabular-nums" style={{ color: c.color }}>{pct}%</span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <button
          type="button" onClick={onAdd} disabled={busy} aria-label={`Add a topic to ${c.name}`}
          className="btn-ghost min-h-[2.75rem] shrink-0 !px-3 text-xs"
        >
          <Plus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Add topic</span>
        </button>
      </div>

      <div className="px-4 pb-4 sm:px-5">
        <ProgressBar value={c.pct} color={c.color} height="h-1.5" label={`${c.name} completion`} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {topics.length === 0 ? (
              <p className="border-t border-white/[0.05] px-5 py-4 text-sm text-ink-soft">No topics in this category yet. Use Add topic to create one.</p>
            ) : (
              <ul>
                {topics.map((t) => (
                  <TopicRow
                    key={t.id} topic={t} color={c.color} busy={busy}
                    onToggleComplete={onToggleComplete} onStart={onStart} onEdit={onEdit} onDelete={onDelete}
                  />
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
