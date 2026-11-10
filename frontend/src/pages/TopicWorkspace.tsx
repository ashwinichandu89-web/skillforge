import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Download, ExternalLink, Flag, Loader2,
  Pencil, Play, Plus, RotateCcw, StickyNote, Timer, Trash2, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { api } from '../api/endpoints';
import { ResourceFormModal } from '../components/forms/ResourceFormModal';
import { SessionFormModal } from '../components/forms/SessionFormModal';
import { TopicFormModal } from '../components/forms/TopicFormModal';
import { KindIcon } from '../components/icons';
import { Async } from '../components/ui/Async';
import { DifficultyBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Card, CardTitle } from '../components/ui/Card';
import { ErrorState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProgressRing } from '../components/ui/ProgressRing';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../context/ToastContext';
import { AFTER_PROGRESS, AFTER_TIME, useAction } from '../hooks/useAction';
import { useQuery } from '../hooks/useQuery';
import { setLastTopic, useRoadmap } from '../hooks/useRoadmap';
import { KIND_LABEL, fmtDate, fmtHours, fmtMinutes, localISO, parseISO, relativeDays } from '../lib/format';
import type { CatalogResource, Note, SessionRow, TopicDetail, UserResource } from '../types';

type Objective = TopicDetail['objectives'][number];
type Exercise = TopicDetail['exercises'][number];

/** Everything a deleted custom topic should refresh. 'topic' is left out on purpose: that topic no longer exists. */
const AFTER_TOPIC_DELETE = ['roadmap', 'overview', 'analytics', 'achievements', 'planner'];

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function timeAgo(iso: string): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return '';
}

function daysFromToday(iso: string): number {
  return Math.round((parseISO(iso).getTime() - parseISO(localISO()).getTime()) / 86_400_000);
}

/* -------------------------------------------------------------------------------------------------
 * Route component: resolves the id, loads the topic, and handles the "does not exist" case.
 * ------------------------------------------------------------------------------------------------- */
export default function TopicWorkspace() {
  const { topicId } = useParams<{ topicId: string }>();
  const id = Number(topicId);
  const valid = Number.isInteger(id) && id > 0;
  const query = useQuery<TopicDetail>(valid ? `topic:${id}` : null, () => api.topics.get(id));

  const missing = !valid || (query.error instanceof ApiError && query.error.status === 404);
  if (missing) {
    return (
      <>
        <PageHeader title="Topic not found" subtitle="It may have been deleted, or the link is wrong." />
        <ErrorState message="That topic doesn't exist in your account." />
        <div className="mt-4 text-center"><Link to="/roadmap" className="btn-primary min-h-[44px]">Back to the roadmap</Link></div>
      </>
    );
  }

  return (
    <Async query={query}>
      {/* While the route changes to another topic, the hook briefly still holds the previous one. */}
      {(topic) => (topic.id === id ? <Workspace key={topic.id} topic={topic} /> : <PageSkeleton />)}
    </Async>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The workspace itself
 * ------------------------------------------------------------------------------------------------- */
function Workspace({ topic }: { topic: TopicDetail }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const roadmap = useRoadmap();
  const { busy, run } = useAction();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeDate, setCompleteDate] = useState(localISO());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [resourceModal, setResourceModal] = useState<{ open: boolean; resource: UserResource | null }>({ open: false, resource: null });
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLastTopic(topic.id); }, [topic.id]);

  const color = topic.category.color;
  const remaining = topic.objectives.filter((o) => !o.done).length;
  const isCompleted = topic.status === 'completed';
  const categories = roadmap.data ?? [];

  const start = () => run(() => api.topics.start(topic.id), { success: 'Topic started. Good luck!', invalidate: AFTER_PROGRESS });
  const reopen = () => run(() => api.topics.reopen(topic.id), { success: 'Topic reopened', invalidate: AFTER_PROGRESS });
  const complete = () => run(
    () => api.topics.complete(topic.id, completeDate || undefined),
    { success: 'Topic marked as completed', invalidate: AFTER_PROGRESS, onDone: () => setCompleteOpen(false) },
  );
  const remove = () => run(
    () => api.topics.remove(topic.id),
    { success: 'Topic deleted', invalidate: AFTER_TOPIC_DELETE, onDone: () => { setDeleteOpen(false); navigate('/roadmap'); } },
  );

  const openComplete = () => { setCompleteDate(localISO()); setCompleteOpen(true); };
  const focusComposer = () => {
    const el = composerRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  // Target-date wording: always text, never colour alone.
  const targetDays = topic.target_date ? daysFromToday(topic.target_date) : null;
  const overdue = targetDays !== null && targetDays < 0 && !isCompleted;
  const hoursPct = topic.estimated_hours > 0 ? Math.min(100, (topic.study_hours / topic.estimated_hours) * 100) : 0;

  const hasCatalogContent =
    topic.concepts.length > 0 || topic.exercises.length > 0 || !!topic.mini_project.trim() ||
    topic.interview_questions.length > 0 || topic.completion_criteria.length > 0 || topic.recommended_resources.length > 0;

  return (
    <>
      <PageHeader
        title={topic.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1">
            <Link to="/roadmap" className="rounded font-semibold hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60">Roadmap</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="font-semibold" style={{ color }}>{topic.category.name}</span>
          </span>
        }
        actions={
          <div className="w-full sm:w-72">
            <label className="sr-only" htmlFor="topic-switcher">Switch topic</label>
            <select id="topic-switcher" className="input" value={topic.id} onChange={(e) => navigate(`/topics/${e.target.value}`)}>
              {categories.length === 0 && <option value={topic.id}>{topic.title}</option>}
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        }
      />

      {/* Hero: status, facts, progress and the actions */}
      <Card className="mb-4" style={{ backgroundImage: `linear-gradient(135deg, ${color}26, transparent 55%)` }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={topic.status} />
              <DifficultyBadge difficulty={topic.difficulty} />
              <PriorityBadge priority={topic.priority} />
              {topic.is_custom && <span className="inline-flex rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs font-semibold text-ink-soft">Custom topic</span>}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
              <Fact icon={<Play className="h-3.5 w-3.5" aria-hidden />} label="Started" value={fmtDate(topic.start_date)} />
              <Fact
                icon={<Flag className="h-3.5 w-3.5" aria-hidden />} label="Target"
                value={fmtDate(topic.target_date)}
                sub={targetDays !== null && !isCompleted ? (overdue ? `Overdue, ${relativeDays(targetDays)}` : relativeDays(targetDays)) : undefined}
                subWarn={overdue}
              />
              <Fact icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />} label="Completed" value={fmtDate(topic.completed_date)} />
              <div>
                <dt className="label !mb-0.5 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />Study hours</dt>
                <dd className="text-sm font-semibold tabular-nums">{fmtHours(topic.study_hours)} <span className="font-medium text-ink-mute">of {fmtHours(topic.estimated_hours)} est.</span></dd>
                <ProgressBar value={hoursPct} color={color} height="h-1" className="mt-1.5" label="Study hours against estimate" />
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-2">
            <ProgressRing value={topic.progress_pct} size={104} stroke={10} color={color} label={`${Math.round(topic.progress_pct)} percent of objectives done`}>
              <span>
                <span className="h-display block text-xl tabular-nums">{Math.round(topic.progress_pct)}%</span>
                {topic.objectives_total > 0 && <span className="block text-[0.65rem] text-ink-mute">{topic.objectives_done}/{topic.objectives_total} objectives</span>}
              </span>
            </ProgressRing>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {topic.status === 'not_started' && (
            <button type="button" className="btn-primary min-h-[44px]" disabled={busy} onClick={() => void start()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}Start Learning
            </button>
          )}
          {isCompleted ? (
            <button type="button" className="btn-secondary min-h-[44px]" disabled={busy} onClick={() => void reopen()}>
              <RotateCcw className="h-4 w-4" aria-hidden />Reopen topic
            </button>
          ) : (
            <button type="button" className="btn-success min-h-[44px]" disabled={busy} onClick={openComplete}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />Mark as Completed
            </button>
          )}
          <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setSessionOpen(true)}><Timer className="h-4 w-4" aria-hidden />Update Progress</button>
          <button type="button" className="btn-secondary min-h-[44px]" onClick={focusComposer}><StickyNote className="h-4 w-4" aria-hidden />Add Notes</button>
          <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setResourceModal({ open: true, resource: null })}><Plus className="h-4 w-4" aria-hidden />Add Resource</button>
          <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Edit topic</button>
          {topic.is_custom && (
            <button type="button" className="btn-danger min-h-[44px]" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" aria-hidden />Delete</button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle title="Overview" icon={<BookOpen className="h-4 w-4" aria-hidden />} />
            {topic.overview.trim()
              ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{topic.overview}</p>
              : <p className="text-sm text-ink-soft">No overview yet. Use <span className="font-semibold text-ink">Edit topic</span> to describe what this is and why it matters to you.</p>}
          </Card>

          {topic.concepts.length > 0 && (
            <Card>
              <CardTitle title="Concepts to understand" subtitle="If you can explain each in your own words, you've got it." />
              <ul className="flex flex-wrap gap-2">
                {topic.concepts.map((c) => <li key={c} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm">{c}</li>)}
              </ul>
            </Card>
          )}

          <ObjectivesCard topic={topic} remaining={remaining} onComplete={openComplete} />

          {topic.exercises.length > 0 && (
            <Card>
              <CardTitle
                title="Practical exercises" subtitle={`${topic.exercises.filter((e) => e.done).length} of ${topic.exercises.length} done`}
              />
              <ul className="-mx-2">
                {topic.exercises.map((e) => <ExerciseRow key={e.index} exercise={e} topicId={topic.id} />)}
              </ul>
            </Card>
          )}

          {topic.mini_project.trim() && (
            <Card>
              <CardTitle title="Mini-project" subtitle="Build this to prove the skill, not just read about it." />
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{topic.mini_project}</p>
            </Card>
          )}

          <NotesCard topic={topic} composerRef={composerRef} />

          {topic.interview_questions.length > 0 && (
            <Disclosure title="Interview questions" count={topic.interview_questions.length}>
              <p className="mb-3 text-xs text-ink-mute">Answer these out loud, then write your best answers in Notes.</p>
              <ol className="list-decimal space-y-2.5 pl-5 text-sm text-ink-soft marker:text-ink-mute">
                {topic.interview_questions.map((q) => <li key={q} className="pl-1">{q}</li>)}
              </ol>
            </Disclosure>
          )}

          {!hasCatalogContent && (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-ink-soft">
              This is your own topic, so it has no built-in exercises or interview questions. Add objectives above, write notes, and save resources as you learn.
            </p>
          )}
        </div>

        {/* Side rail */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1" aria-label="Topic resources and history">
          {topic.completion_criteria.length > 0 && (
            <Card>
              <CardTitle title="Completion criteria" subtitle="Be able to say yes to all of these" />
              <ul className="space-y-2.5">
                {topic.completion_criteria.map((c) => (
                  <li key={c} className="flex gap-2.5 text-sm text-ink-soft">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-white/20" aria-hidden><Check className="h-3 w-3 text-ink-mute" /></span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle
              title="My resources" subtitle="Saved for this topic"
              action={<button type="button" className="btn-ghost !px-2 !py-1.5" onClick={() => setResourceModal({ open: true, resource: null })} aria-label="Add a resource"><Plus className="h-4 w-4" aria-hidden /></button>}
            />
            {topic.resources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
                <p className="text-sm text-ink-soft">Nothing saved yet. Keep the best tutorial, repo or PDF here.</p>
                <button type="button" className="btn-secondary mt-3 min-h-[44px]" onClick={() => setResourceModal({ open: true, resource: null })}><Plus className="h-4 w-4" aria-hidden />Add Resource</button>
              </div>
            ) : (
              <ul className="space-y-2">
                {topic.resources.map((r) => <MyResourceRow key={r.id} resource={r} onEdit={(res) => setResourceModal({ open: true, resource: res })} />)}
              </ul>
            )}
          </Card>

          {topic.recommended_resources.length > 0 && (
            <Card>
              <CardTitle title="Recommended resources" subtitle="Curated starting points" />
              <ul className="space-y-1">
                {topic.recommended_resources.map((r) => <RecommendedRow key={`${r.title}|${r.url ?? ''}`} resource={r} />)}
              </ul>
            </Card>
          )}

          <SessionsCard topic={topic} />
        </aside>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={completeOpen} title="Mark this topic as completed?" confirmLabel="Yes, mark completed" busy={busy}
        onConfirm={() => void complete()} onCancel={() => setCompleteOpen(false)}
        message={
          <div className="space-y-3">
            <p>Completing <span className="font-semibold text-ink">{topic.title}</span> awards XP and is recorded in your history. You can reopen it later.</p>
            {remaining > 0 && (
              <p className="rounded-lg bg-brand-orange/10 px-3 py-2 text-brand-orange">
                {remaining} of {topic.objectives.length} learning {remaining === 1 ? 'objective is' : 'objectives are'} still unticked. You can complete the topic anyway.
              </p>
            )}
            <Field label="Completion date" htmlFor="complete-date">
              <input id="complete-date" type="date" className="input" value={completeDate} max={localISO()} min={topic.start_date ?? undefined} onChange={(e) => setCompleteDate(e.target.value)} />
            </Field>
          </div>
        }
      />
      <ConfirmDialog
        open={deleteOpen} title="Delete this topic?" confirmLabel="Delete topic" danger busy={busy}
        onConfirm={() => void remove()} onCancel={() => setDeleteOpen(false)}
        message={<p><span className="font-semibold text-ink">{topic.title}</span> will be deleted with its notes, objectives and progress. Logged study time stays in your totals. This can't be undone.</p>}
      />
      <TopicFormModal open={editOpen} onClose={() => setEditOpen(false)} categories={categories} topic={topic} />
      <SessionFormModal open={sessionOpen} onClose={() => setSessionOpen(false)} topicId={topic.id} categoryId={topic.category_id} title={`Update progress: ${topic.title}`} />
      <ResourceFormModal
        open={resourceModal.open} onClose={() => setResourceModal((s) => ({ ...s, open: false }))}
        resource={resourceModal.resource} defaultTopicId={topic.id} defaultCategoryId={topic.category_id}
      />
      {/* Keeps motion imports honest for the disclosure below */}
      <AnimatePresence />
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Small building blocks
 * ------------------------------------------------------------------------------------------------- */
function Fact({ icon, label, value, sub, subWarn = false }: { icon: ReactNode; label: string; value: string; sub?: string; subWarn?: boolean }) {
  return (
    <div>
      <dt className="label !mb-0.5 flex items-center gap-1.5">{icon}{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
      {sub && <p className={`text-xs ${subWarn ? 'font-semibold text-brand-orange' : 'text-ink-mute'}`}>{sub}</p>}
    </div>
  );
}

/** A native checkbox in a 44px-tall row. Done state is shown with strikethrough as well as the tick. */
function CheckRow({ checked, label, disabled, onChange, trailing }: {
  checked: boolean; label: string; disabled?: boolean; onChange: (next: boolean) => void; trailing?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1 rounded-xl transition hover:bg-white/[0.03]">
      <label className="flex min-h-[44px] flex-1 cursor-pointer items-start gap-3 px-2 py-2.5">
        <input
          type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-brand-purple disabled:cursor-wait"
        />
        <span className={`text-sm ${checked ? 'text-ink-mute line-through' : 'text-ink'}`}>{label}</span>
      </label>
      {trailing}
    </li>
  );
}

function ObjectivesCard({ topic, remaining, onComplete }: { topic: TopicDetail; remaining: number; onComplete: () => void }) {
  const { busy, run } = useAction();
  const [text, setText] = useState('');
  const total = topic.objectives.length;
  const done = total - remaining;

  const add = async () => {
    const clean = text.trim();
    if (!clean) return;
    const res = await run(() => api.topics.addObjective(topic.id, clean), { invalidate: AFTER_PROGRESS });
    if (res) setText('');
  };

  return (
    <Card>
      <CardTitle title="Learning objectives" subtitle={total ? `${done} of ${total} done. Ticking objectives never completes the topic by itself.` : 'Break the topic into checkable steps.'} />
      {total > 0 && <ProgressBar value={(done / total) * 100} color={topic.category.color} className="mb-3" label="Objectives completed" />}
      {total === 0 ? (
        <p className="text-sm text-ink-soft">{topic.is_custom ? 'No objectives yet. Add the first one below.' : 'This topic has no objectives.'}</p>
      ) : (
        <ul className="-mx-2">
          {topic.objectives.map((o) => <ObjectiveRow key={o.id} objective={o} topicId={topic.id} removable={topic.is_custom} />)}
        </ul>
      )}

      {topic.is_custom && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <label className="sr-only" htmlFor="new-objective">New learning objective</label>
          <input id="new-objective" className="input" value={text} maxLength={300} placeholder="Add an objective" onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn-secondary min-h-[44px] shrink-0" disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}Add
          </button>
        </form>
      )}

      {total > 0 && remaining === 0 && topic.status !== 'completed' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-teal/10 px-4 py-3">
          <p className="text-sm text-brand-teal">Every objective is ticked. When you're confident, mark the topic as completed.</p>
          <button type="button" className="btn-success min-h-[44px]" onClick={onComplete}><CheckCircle2 className="h-4 w-4" aria-hidden />Mark as Completed</button>
        </div>
      )}
    </Card>
  );
}

function ObjectiveRow({ objective, topicId, removable }: { objective: Objective; topicId: number; removable: boolean }) {
  const { busy, run } = useAction();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);

  // Once the refreshed topic arrives, the server's value takes over from the optimistic one.
  useEffect(() => { setOptimistic(null); }, [objective.done]);

  const toggle = async (next: boolean) => {
    setOptimistic(next);
    const res = await run(() => api.topics.setObjective(topicId, objective.id, next), { invalidate: AFTER_PROGRESS });
    if (!res) setOptimistic(null);
  };
  const remove = () => run(() => api.topics.removeObjective(topicId, objective.id), {
    success: 'Objective removed', invalidate: AFTER_PROGRESS, onDone: () => setConfirm(false),
  });

  return (
    <>
      <CheckRow
        checked={optimistic ?? objective.done} label={objective.text} disabled={busy} onChange={(n) => void toggle(n)}
        trailing={removable ? (
          <button type="button" onClick={() => setConfirm(true)} aria-label={`Remove objective: ${objective.text}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-white/[0.08] hover:text-red-300">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : undefined}
      />
      <ConfirmDialog
        open={confirm} title="Remove this objective?" confirmLabel="Remove" danger busy={busy}
        onConfirm={() => void remove()} onCancel={() => setConfirm(false)}
        message={<p>"{objective.text}" will be removed from this topic.</p>}
      />
    </>
  );
}

function ExerciseRow({ exercise, topicId }: { exercise: Exercise; topicId: number }) {
  const { busy, run } = useAction();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => { setOptimistic(null); }, [exercise.done]);

  const toggle = async (next: boolean) => {
    setOptimistic(next);
    const res = await run(() => api.topics.setExercise(topicId, exercise.index, next), { invalidate: AFTER_PROGRESS });
    if (!res) setOptimistic(null);
  };
  return <CheckRow checked={optimistic ?? exercise.done} label={exercise.text} disabled={busy} onChange={(n) => void toggle(n)} />;
}

/** Section-level disclosure, collapsed by default. */
function Disclosure({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = `disc-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Card>
      <h2 className="h-display text-base">
        <button
          type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          className="-m-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        >
          <span>{title} <span className="ml-1 text-sm font-medium text-ink-mute">{count}</span></span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId} key="panel" className="overflow-hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Notes
 * ------------------------------------------------------------------------------------------------- */
function NotesCard({ topic, composerRef }: { topic: TopicDetail; composerRef: RefObject<HTMLTextAreaElement> }) {
  const { busy, run } = useAction();
  const [draft, setDraft] = useState('');
  const notes = useMemo(() => [...topic.notes].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [topic.notes]);

  const save = async () => {
    const content = draft.trim();
    if (!content) return;
    const res = await run(() => api.topics.addNote(topic.id, content), { success: 'Note saved', invalidate: ['topic'] });
    if (res) setDraft('');
  };

  return (
    <Card>
      <CardTitle title="Notes" subtitle="Saved to your account and available on every device" icon={<StickyNote className="h-4 w-4" aria-hidden />} />
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="label" htmlFor="note-draft">New note</label>
        <textarea
          id="note-draft" ref={composerRef} className="input min-h-[6rem]" value={draft} maxLength={10000}
          placeholder="What did you learn? What's still unclear?" onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-mute tabular-nums">{draft.length.toLocaleString()} / 10,000</span>
          <button type="submit" className="btn-primary min-h-[44px]" disabled={busy || !draft.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save note
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No notes yet. Writing things in your own words is the fastest way to find gaps.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => <NoteItem key={n.id} note={n} />)}
        </ul>
      )}
    </Card>
  );
}

function NoteItem({ note }: { note: Note }) {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);
  const [confirm, setConfirm] = useState(false);

  const edited = Date.parse(note.updated_at) - Date.parse(note.created_at) > 2000;
  const ago = timeAgo(note.created_at);

  const save = async () => {
    const content = text.trim();
    if (!content) return;
    if (content === note.content) { setEditing(false); return; }
    const res = await run(() => api.notes.update(note.id, content), { success: 'Note updated', invalidate: ['topic'] });
    if (res) setEditing(false);
  };
  const remove = () => run(() => api.notes.remove(note.id), { success: 'Note deleted', invalidate: ['topic'], onDone: () => setConfirm(false) });

  return (
    <li className="rounded-xl border border-white/[0.06] bg-navy-900/60 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <time dateTime={note.created_at} className="text-xs text-ink-mute">
          {ago ? `${ago} · ` : ''}{fmtDateTime(note.created_at)}{edited ? ' · edited' : ''}
        </time>
        {!editing && (
          <div className="-mr-1.5 -mt-1.5 flex shrink-0">
            <button type="button" onClick={() => { setText(note.content); setEditing(true); }} aria-label="Edit note" className="grid h-9 w-9 place-items-center rounded-lg text-ink-mute hover:bg-white/[0.08] hover:text-ink"><Pencil className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={() => setConfirm(true)} aria-label="Delete note" className="grid h-9 w-9 place-items-center rounded-lg text-ink-mute hover:bg-white/[0.08] hover:text-red-300"><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <label className="sr-only" htmlFor={`note-${note.id}`}>Edit note</label>
          <textarea id={`note-${note.id}`} className="input min-h-[6rem]" value={text} maxLength={10000} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost min-h-[44px]" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="btn-primary min-h-[44px]" disabled={busy || !text.trim()} onClick={() => void save()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">{note.content}</p>
      )}
      <ConfirmDialog
        open={confirm} title="Delete this note?" confirmLabel="Delete note" danger busy={busy}
        onConfirm={() => void remove()} onCancel={() => setConfirm(false)}
        message={<p>This note will be permanently deleted.</p>}
      />
    </li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Resources
 * ------------------------------------------------------------------------------------------------- */
function RecommendedRow({ resource }: { resource: CatalogResource }) {
  const body = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft"><KindIcon kind={resource.kind} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{resource.title}</span>
        <span className="block text-xs text-ink-mute">{KIND_LABEL[resource.kind]}</span>
      </span>
    </>
  );
  return (
    <li>
      {resource.url ? (
        <a
          href={resource.url} target="_blank" rel="noopener noreferrer"
          className="flex min-h-[44px] items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        >
          {body}<ExternalLink className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <div className="flex min-h-[44px] items-center gap-3 px-2 py-1.5">{body}</div>
      )}
    </li>
  );
}

function MyResourceRow({ resource, onEdit }: { resource: UserResource; onEdit: (r: UserResource) => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [opening, setOpening] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const download = async () => {
    setOpening(true);
    try {
      const { url } = await api.resources.downloadUrl(resource.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error("Couldn't open the file", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  };
  const remove = () => run(() => api.resources.remove(resource.id), {
    success: 'Resource removed', invalidate: ['resources', 'topic'], onDone: () => setConfirm(false),
  });

  const iconBtn = 'grid h-9 w-9 place-items-center rounded-lg text-ink-mute hover:bg-white/[0.08] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60';
  return (
    <li className="rounded-xl border border-white/[0.06] bg-navy-900/60 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft"><KindIcon kind={resource.kind} /></span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{resource.title}</p>
          <p className="text-xs text-ink-mute">{KIND_LABEL[resource.kind]}{resource.has_file && resource.filename ? ` · ${resource.filename}` : ''}</p>
          {resource.notes.trim() && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-ink-soft">{resource.notes}</p>}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-0.5">
        {resource.url && (
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label={`Open ${resource.title} in a new tab`}><ExternalLink className="h-4 w-4" aria-hidden /></a>
        )}
        {resource.has_file && (
          <button type="button" className={iconBtn} disabled={opening} onClick={() => void download()} aria-label={`Download ${resource.filename ?? resource.title}`}>
            {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          </button>
        )}
        <button type="button" className={iconBtn} onClick={() => onEdit(resource)} aria-label={`Edit ${resource.title}`}><Pencil className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={`${iconBtn} hover:!text-red-300`} onClick={() => setConfirm(true)} aria-label={`Delete ${resource.title}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
      </div>
      <ConfirmDialog
        open={confirm} title="Delete this resource?" confirmLabel="Delete" danger busy={busy}
        onConfirm={() => void remove()} onCancel={() => setConfirm(false)}
        message={<p><span className="font-semibold text-ink">{resource.title}</span> will be removed{resource.has_file ? ', and its uploaded file deleted' : ''}.</p>}
      />
    </li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Study session history
 * ------------------------------------------------------------------------------------------------- */
const SESSIONS_SHOWN = 6;

function SessionsCard({ topic }: { topic: TopicDetail }) {
  const [all, setAll] = useState(false);
  const sessions = useMemo(
    () => [...topic.sessions].sort((a, b) => (a.session_date === b.session_date ? b.id - a.id : a.session_date < b.session_date ? 1 : -1)),
    [topic.sessions],
  );
  const visible = all ? sessions : sessions.slice(0, SESSIONS_SHOWN);
  return (
    <Card>
      <CardTitle title="Study sessions" subtitle={sessions.length ? `${fmtHours(topic.study_hours)} logged` : undefined} />
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-soft">No time logged for this topic yet. Press <span className="font-semibold text-ink">Update Progress</span> after a study session.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((s) => <SessionItem key={s.id} session={s} />)}
          </ul>
          {sessions.length > SESSIONS_SHOWN && (
            <button type="button" className="btn-ghost mt-2 min-h-[44px] w-full" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${sessions.length} sessions`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function SessionItem({ session }: { session: SessionRow }) {
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const remove = () => run(() => api.sessions.remove(session.id), { success: 'Session deleted', invalidate: AFTER_TIME, onDone: () => setConfirm(false) });
  return (
    <li className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-navy-900/60 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{fmtDate(session.session_date)} <span className="font-medium text-ink-soft">· {fmtMinutes(session.minutes)}</span></p>
        {session.problems_solved > 0 && <p className="text-xs text-ink-soft">{session.problems_solved} {session.problems_solved === 1 ? 'problem' : 'problems'} solved</p>}
        {session.notes.trim() && <p className="mt-0.5 whitespace-pre-line break-words text-xs text-ink-soft">{session.notes}</p>}
      </div>
      <button type="button" onClick={() => setConfirm(true)} aria-label={`Delete the ${fmtMinutes(session.minutes)} session from ${fmtDate(session.session_date)}`} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-white/[0.08] hover:text-red-300">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={confirm} title="Delete this session?" confirmLabel="Delete session" danger busy={busy}
        onConfirm={() => void remove()} onCancel={() => setConfirm(false)}
        message={<p>{fmtMinutes(session.minutes)} on {fmtDate(session.session_date)} will be removed from your hours, streak and charts.</p>}
      />
    </li>
  );
}
