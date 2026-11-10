import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/endpoints';
import { AFTER_PROGRESS, useAction } from '../../hooks/useAction';
import { DIFFICULTY_LABEL, PRIORITY_LABEL } from '../../lib/format';
import type { Difficulty, Priority, RoadmapCategory, TopicDetail, TopicSummary } from '../../types';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Pick<RoadmapCategory, 'id' | 'name'>[];
  /** Present = edit mode; absent = create a custom topic. */
  topic?: TopicSummary | null;
  defaultCategoryId?: number;
  onSaved?: (t: TopicDetail) => void;
}

/**
 * Create a custom topic or edit an existing one.
 * Built-in topics are shared catalog rows, so editing one stores YOUR overrides (title, overview, difficulty,
 * priority, dates); estimated hours and objectives can only be changed on topics you created.
 */
export function TopicFormModal({ open, onClose, categories, topic, defaultCategoryId, onSaved }: Props) {
  const editing = !!topic;
  const { busy, run } = useAction();
  const [formError, setFormError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [priority, setPriority] = useState<Priority>('medium');
  const [hours, setHours] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [objectives, setObjectives] = useState('');

  // Load fresh values every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setCategoryId(topic?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '');
    setTitle(topic?.title ?? '');
    setOverview(topic?.overview ?? '');
    setDifficulty(topic?.difficulty ?? 'beginner');
    setPriority(topic?.priority ?? 'medium');
    setHours(String(topic?.estimated_hours ?? 10));
    setStartDate(topic?.start_date ?? '');
    setTargetDate(topic?.target_date ?? '');
    setObjectives('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic?.id]);

  const canEditHours = !editing || !!topic?.is_custom;

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return setFormError('Give the topic a title.');
    if (cleanTitle.length > 160) return setFormError('The title must be 160 characters or fewer.');
    const h = Number(hours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) return setFormError('Estimated hours must be between 0 and 1000.');
    if (startDate && targetDate && targetDate < startDate) return setFormError('The target date cannot be before the start date.');
    setFormError(null);

    let saved: TopicDetail | undefined;
    if (editing && topic) {
      // Send only what changed, so untouched built-in fields are never turned into overrides.
      const body: Record<string, unknown> = {};
      if (cleanTitle !== topic.title) body.title = cleanTitle;
      if (overview.trim() !== topic.overview.trim()) body.overview = overview.trim();
      if (difficulty !== topic.difficulty) body.difficulty = difficulty;
      if (priority !== topic.priority) body.priority = priority;
      if (canEditHours && h !== topic.estimated_hours) body.estimated_hours = h;
      if (startDate !== (topic.start_date ?? '')) { if (startDate) body.start_date = startDate; else body.clear_start_date = true; }
      if (targetDate !== (topic.target_date ?? '')) { if (targetDate) body.target_date = targetDate; else body.clear_target_date = true; }
      if (Object.keys(body).length === 0) { onClose(); return; }
      saved = await run(() => api.topics.update(topic.id, body), { success: 'Topic updated', invalidate: AFTER_PROGRESS });
    } else {
      if (categoryId === '') return setFormError('Choose a category.');
      const lines = objectives.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 30) return setFormError('Add at most 30 objectives.');
      if (lines.some((l) => l.length > 300)) return setFormError('Each objective must be 300 characters or fewer.');
      saved = await run(
        () => api.topics.create({
          category_id: categoryId, title: cleanTitle, overview: overview.trim(), difficulty, priority,
          estimated_hours: h, target_date: targetDate || null, objectives: lines,
        }),
        { success: 'Topic added', invalidate: AFTER_PROGRESS },
      );
    }
    if (saved) { onClose(); onSaved?.(saved); }
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose} size="md"
      title={editing ? 'Edit topic' : 'Add a custom topic'}
      description={editing && !topic?.is_custom ? 'This is a built-in topic. Your changes apply to your account only.' : undefined}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="topic-form" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Add topic'}
          </button>
        </>
      }
    >
      <form id="topic-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}

        {!editing && (
          <Field label="Category" htmlFor="tf-category">
            <select id="tf-category" className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Title" htmlFor="tf-title">
          <input id="tf-title" className="input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GraphQL basics" required />
        </Field>

        <Field label="Overview" htmlFor="tf-overview" hint="What this topic is and why it matters to you.">
          <textarea id="tf-overview" className="input min-h-[5.5rem]" value={overview} maxLength={5000} onChange={(e) => setOverview(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Difficulty" htmlFor="tf-difficulty">
            <select id="tf-difficulty" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
            </select>
          </Field>
          <Field label="Priority" htmlFor="tf-priority">
            <select id="tf-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field label="Estimated hours" htmlFor="tf-hours" hint={canEditHours ? undefined : 'Fixed for built-in topics.'}>
            <input id="tf-hours" className="input" type="number" min={0} max={1000} step="0.5" value={hours} disabled={!canEditHours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          {editing && (
            <Field label="Start date" htmlFor="tf-start">
              <input id="tf-start" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          )}
          <Field label="Target completion date" htmlFor="tf-target">
            <input id="tf-target" className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>

        {!editing && (
          <Field label="Learning objectives" htmlFor="tf-objectives" hint="One per line. You can tick them off from the topic workspace.">
            <textarea id="tf-objectives" className="input min-h-[6rem]" value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder={'Explain how queries and mutations differ\nBuild a small schema'} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
