import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/endpoints';
import { useAction } from '../../hooks/useAction';
import { useRoadmapWhen } from '../../hooks/useRoadmap';
import { localISO } from '../../lib/format';
import type { Plan } from '../../types';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode. */
  plan?: Plan | null;
  /** Pre-filled date for a new block (a day in the planner). Defaults to today. */
  defaultDate?: string;
  onSaved?: (p: Plan) => void;
}

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

/** Create or edit one planned study block: when, how long, for which category/topic, and an optional deadline. */
export function PlanFormModal({ open, onClose, plan, defaultDate, onSaved }: Props) {
  const editing = !!plan;
  const { busy, run } = useAction();
  const roadmap = useRoadmapWhen(open);
  const categories = roadmap.data ?? [];

  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(localISO());
  const [minutes, setMinutes] = useState('60');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const topicsInCategory = useMemo(
    () => (categoryId === '' ? [] : categories.find((c) => c.id === categoryId)?.topics ?? []),
    [categories, categoryId],
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setTitle(plan?.title ?? '');
    setDay(plan?.plan_date ?? defaultDate ?? localISO());
    setMinutes(String(plan?.planned_minutes ?? 60));
    setCategoryId(plan?.category_id ?? '');
    setTopicId(plan?.topic_id ?? '');
    setDeadline(plan?.deadline ?? '');
    setNotes(plan?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id, defaultDate]);

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return setFormError('Give the study block a title.');
    if (!day) return setFormError('Choose a date.');
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1 || m > 1440) return setFormError('Planned time must be between 1 and 1440 minutes.');
    if (deadline && deadline < day) return setFormError("The deadline can't be before the planned date.");
    setFormError(null);

    const body = {
      title: cleanTitle, plan_date: day, planned_minutes: m,
      category_id: categoryId === '' ? null : categoryId,
      topic_id: topicId === '' ? null : topicId,
      deadline: deadline || null, // null clears an existing deadline
      notes: notes.trim(),
    };
    const saved = await run<Plan>(
      () => (editing && plan ? api.plans.update(plan.id, body) : api.plans.create(body)),
      { success: editing ? 'Study block updated' : 'Study block added', invalidate: ['planner'] },
    );
    if (saved) { onClose(); onSaved?.(saved); }
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose}
      title={editing ? 'Edit study block' : 'Add a study block'}
      description="Plan time for a topic or a whole category. Skipped blocks stop counting toward your weekly plan."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="plan-form" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Add block'}
          </button>
        </>
      }
    >
      <form id="plan-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}

        <Field label="What will you study?" htmlFor="pf-title">
          <input id="pf-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finish REST API exercises" data-autofocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="pf-date">
            <input id="pf-date" className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Planned minutes" htmlFor="pf-minutes">
            <input id="pf-minutes" className="input" type="number" min={1} max={1440} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        </div>

        <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick durations">
          {QUICK_MINUTES.map((q) => (
            <button
              key={q} type="button" onClick={() => setMinutes(String(q))}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${Number(minutes) === q ? 'bg-brand-purple text-white' : 'bg-white/[0.06] text-ink-soft hover:bg-white/[0.1]'}`}
            >
              {q >= 60 ? `${q / 60}h` : `${q}m`}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="pf-category">
            <select
              id="pf-category" className="input" value={categoryId}
              onChange={(e) => {
                const next = e.target.value === '' ? '' : Number(e.target.value);
                setCategoryId(next);
                if (topicId !== '' && !categories.find((c) => c.id === next)?.topics.some((t) => t.id === topicId)) setTopicId('');
              }}
            >
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Topic" htmlFor="pf-topic">
            <select id="pf-topic" className="input" value={topicId} disabled={categoryId === ''} onChange={(e) => setTopicId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">{categoryId === '' ? 'Pick a category first' : 'Whole category'}</option>
              {topicsInCategory.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Deadline" htmlFor="pf-deadline" hint="Optional. When this needs to be finished by.">
          <input id="pf-deadline" className="input" type="date" value={deadline} min={day || undefined} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        <Field label="Notes" htmlFor="pf-notes">
          <textarea id="pf-notes" className="input min-h-[4.5rem]" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {roadmap.error && !roadmap.data && <p className="text-xs text-brand-orange">Couldn't load categories. You can still save without one.</p>}
      </form>
    </Modal>
  );
}
