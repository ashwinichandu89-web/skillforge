import { ChevronsDownUp, ChevronsUpDown, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/endpoints';
import { TopicFormModal } from '../components/forms/TopicFormModal';
import { CategoryCard } from '../components/roadmap/CategoryCard';
import { Async } from '../components/ui/Async';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Segmented } from '../components/ui/Segmented';
import { AFTER_PROGRESS, AFTER_TIME, useAction } from '../hooks/useAction';
import { useRoadmap } from '../hooks/useRoadmap';
import { DIFFICULTY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import type { Difficulty, Priority, RoadmapCategory, Status, TopicSummary } from '../types';

type StatusFilter = 'all' | Status;
type DifficultyFilter = 'all' | Difficulty;
type PriorityFilter = 'all' | Priority;
type ConfirmKind = 'complete' | 'reopen' | 'delete';
interface Confirm { kind: ConfirmKind; topic: TopicSummary }
interface FormState { open: boolean; topic: TopicSummary | null; categoryId?: number }

const OPEN_KEY = 'sf:roadmap:open';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: STATUS_LABEL.in_progress },
  { value: 'not_started', label: STATUS_LABEL.not_started },
  { value: 'completed', label: STATUS_LABEL.completed },
];

/** Which categories the user left expanded. A convenience only; null means nothing was saved yet. */
function readOpen(): number[] | null {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : null;
  } catch { return null; }
}

const confirmCopy = (c: Confirm): { title: string; message: string; label: string; danger: boolean } => {
  switch (c.kind) {
    case 'complete':
      return {
        title: `Mark “${c.topic.title}” as completed?`,
        message: "Only confirm once you've met the topic's completion criteria. The date goes into your completion history and the topic's XP is awarded. You can reopen it later.",
        label: 'Mark as completed', danger: false,
      };
    case 'reopen':
      return {
        title: `Reopen “${c.topic.title}”?`,
        message: 'The topic goes back to In progress and the XP it earned is taken back. Your notes, study hours and objectives are kept.',
        label: 'Reopen topic', danger: false,
      };
    case 'delete':
      return {
        title: `Delete “${c.topic.title}”?`,
        message: 'This permanently deletes your custom topic with its notes, objectives and progress. Study sessions and saved resources stay, but are no longer linked to it.',
        label: 'Delete topic', danger: true,
      };
  }
};

export default function Roadmap() {
  const roadmap = useRoadmap();
  return <Async query={roadmap}>{(categories) => <RoadmapView categories={categories} />}</Async>;
}

function RoadmapView({ categories }: { categories: RoadmapCategory[] }) {
  const navigate = useNavigate();
  const { busy, run } = useAction();

  // ----- filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const needle = q.trim().toLowerCase();
  const filtering = needle !== '' || status !== 'all' || difficulty !== 'all' || priority !== 'all';
  const clearFilters = () => { setQ(''); setStatus('all'); setDifficulty('all'); setPriority('all'); };

  const matches = (t: TopicSummary) =>
    (needle === '' || t.title.toLowerCase().includes(needle)) &&
    (status === 'all' || t.status === status) &&
    (difficulty === 'all' || t.difficulty === difficulty) &&
    (priority === 'all' || t.priority === priority);

  const visible = categories
    .map((category) => ({ category, topics: filtering ? category.topics.filter(matches) : category.topics }))
    .filter((v) => !filtering || v.topics.length > 0);
  const shown = visible.reduce((n, v) => n + v.topics.length, 0);

  // ----- expanded categories: saved choice normally; while filtering, matching categories open unless closed by hand
  const [persisted, setPersisted] = useState<Set<number>>(() => new Set(readOpen() ?? (categories[0] ? [categories[0].id] : [])));
  const [closedWhileFiltering, setClosedWhileFiltering] = useState<Set<number>>(new Set());
  const filterKey = `${needle}|${status}|${difficulty}|${priority}`;
  useEffect(() => { setClosedWhileFiltering(new Set()); }, [filterKey]);

  const savePersisted = (next: Set<number>) => {
    setPersisted(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch { /* preference only */ }
  };
  const isOpen = (id: number) => (filtering ? !closedWhileFiltering.has(id) : persisted.has(id));
  const toggle = (id: number) => {
    if (filtering) {
      setClosedWhileFiltering((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    } else {
      const n = new Set(persisted);
      if (n.has(id)) n.delete(id); else n.add(id);
      savePersisted(n);
    }
  };
  const expandAll = () => (filtering ? setClosedWhileFiltering(new Set()) : savePersisted(new Set(categories.map((c) => c.id))));
  const collapseAll = () => (filtering ? setClosedWhileFiltering(new Set(visible.map((v) => v.category.id))) : savePersisted(new Set()));

  // ----- dialogs. The last confirm/form is kept while closing so their content doesn't flicker during the exit animation.
  const [form, setForm] = useState<FormState>({ open: false, topic: null });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const askConfirm = (kind: ConfirmKind, topic: TopicSummary) => { setConfirm({ kind, topic }); setConfirmOpen(true); };

  const startTopic = (t: TopicSummary) =>
    void run(() => api.topics.start(t.id), { success: `Started “${t.title}”`, invalidate: AFTER_PROGRESS });

  const confirmNow = async () => {
    if (!confirm) return;
    const { kind, topic } = confirm;
    const result =
      kind === 'complete'
        ? await run(() => api.topics.complete(topic.id), { success: `Completed “${topic.title}”`, invalidate: AFTER_PROGRESS })
        : kind === 'reopen'
          ? await run(() => api.topics.reopen(topic.id), { success: `Reopened “${topic.title}”`, invalidate: AFTER_PROGRESS })
          : await run(async () => { await api.topics.remove(topic.id); return true as const; }, { success: 'Topic deleted', invalidate: [...AFTER_TIME, 'resources'] });
    if (result) setConfirmOpen(false);
  };

  // ----- header summary, from the API's own per-category counts
  const total = categories.reduce((n, c) => n + c.total, 0);
  const completed = categories.reduce((n, c) => n + c.completed, 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const copy = confirm ? confirmCopy(confirm) : null;

  return (
    <>
      <PageHeader
        title="Learning Roadmap"
        subtitle={`${completed} of ${total} topics completed across ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}.`}
        actions={
          <>
            <ProgressRing value={pct} size={52} stroke={6} gradient={['#8b5cf6', '#22d3ee']} label={`${pct} percent of the roadmap completed`}>
              <span className="text-xs font-bold tabular-nums">{pct}%</span>
            </ProgressRing>
            <button
              type="button" className="btn-primary min-h-[2.75rem]" disabled={categories.length === 0}
              onClick={() => setForm({ open: true, topic: null })}
            >
              <Plus className="h-4 w-4" aria-hidden />Add custom topic
            </button>
          </>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title="The roadmap is empty"
          body="The built-in catalog hasn't been loaded on the server yet. Run the seed command (python -m app.db.seed) and refresh."
        />
      ) : (
        <>
          <Card className="mb-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
              <div className="relative">
                <label htmlFor="rm-search" className="sr-only">Search topics</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
                <input
                  id="rm-search" type="search" className="input min-h-[2.75rem] pl-9" placeholder="Search topics"
                  value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="rm-difficulty" className="sr-only">Difficulty</label>
                <select id="rm-difficulty" className="input min-h-[2.75rem]" value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}>
                  <option value="all">Any difficulty</option>
                  {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="rm-priority" className="sr-only">Priority</label>
                <select id="rm-priority" className="input min-h-[2.75rem]" value={priority} onChange={(e) => setPriority(e.target.value as PriorityFilter)}>
                  <option value="all">Any priority</option>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]} priority</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented<StatusFilter> value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Filter by status" className="max-w-full overflow-x-auto" />
              <div className="flex flex-wrap items-center gap-1">
                <p className="mr-2 text-xs text-ink-mute" role="status" aria-live="polite">
                  {filtering ? `${shown} ${shown === 1 ? 'topic matches' : 'topics match'}` : `${total} topics`}
                </p>
                {filtering && (
                  <button type="button" className="btn-ghost min-h-[2.5rem] !px-3 text-xs" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" aria-hidden />Clear filters
                  </button>
                )}
                <button type="button" className="btn-ghost min-h-[2.5rem] !px-3 text-xs" onClick={expandAll}>
                  <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />Expand all
                </button>
                <button type="button" className="btn-ghost min-h-[2.5rem] !px-3 text-xs" onClick={collapseAll}>
                  <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden />Collapse all
                </button>
              </div>
            </div>
          </Card>

          {visible.length === 0 ? (
            <EmptyState
              title="No topics match these filters"
              body="Try a different search term or loosen the status, difficulty or priority filters."
              action={<button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>}
            />
          ) : (
            <div className="space-y-4">
              {visible.map(({ category, topics }) => (
                <CategoryCard
                  key={category.id} category={category} topics={topics} open={isOpen(category.id)} filtering={filtering} busy={busy}
                  onToggle={() => toggle(category.id)}
                  onAdd={() => setForm({ open: true, topic: null, categoryId: category.id })}
                  onToggleComplete={(t) => askConfirm(t.status === 'completed' ? 'reopen' : 'complete', t)}
                  onStart={startTopic}
                  onEdit={(t) => setForm({ open: true, topic: t })}
                  onDelete={(t) => askConfirm('delete', t)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <TopicFormModal
        open={form.open} onClose={() => setForm((f) => ({ ...f, open: false }))}
        categories={categories} topic={form.topic} defaultCategoryId={form.categoryId}
        onSaved={(t) => { if (!form.topic) navigate(`/topics/${t.id}`); }}
      />

      {confirm && copy && (
        <ConfirmDialog
          open={confirmOpen} title={copy.title} message={copy.message} confirmLabel={copy.label} danger={copy.danger}
          busy={busy} onConfirm={() => void confirmNow()} onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
