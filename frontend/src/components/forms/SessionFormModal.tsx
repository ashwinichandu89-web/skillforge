import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/endpoints';
import { AFTER_TIME, useAction } from '../../hooks/useAction';
import { DSA_SLUG, useRoadmapWhen } from '../../hooks/useRoadmap';
import { localISO } from '../../lib/format';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select a topic (e.g. when opened from a topic workspace). */
  topicId?: number | null;
  categoryId?: number | null;
  /** Pre-fill the date (e.g. a day in the planner). Defaults to today. */
  date?: string;
  title?: string;
  onSaved?: () => void;
}

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

/**
 * Logs real study time. This is what "Update Progress" means: it feeds study hours, streaks,
 * planned-versus-actual in the planner, the heatmap and gamification.
 */
export function SessionFormModal({ open, onClose, topicId, categoryId, date, title = 'Log study time', onSaved }: Props) {
  const { busy, run } = useAction();
  const roadmap = useRoadmapWhen(open);
  const categories = roadmap.data ?? [];

  const [formError, setFormError] = useState<string | null>(null);
  const [topic, setTopic] = useState<number | ''>('');
  const [category, setCategory] = useState<number | ''>('');
  const [day, setDay] = useState(localISO());
  const [minutes, setMinutes] = useState('30');
  const [problems, setProblems] = useState('0');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setTopic(topicId ?? '');
    setCategory(categoryId ?? '');
    setDay(date ?? localISO());
    setMinutes('30');
    setProblems('0');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topicId, categoryId, date]);

  const topicOwner = useMemo(
    () => (topic === '' ? undefined : categories.find((c) => c.topics.some((t) => t.id === topic))),
    [categories, topic],
  );
  // The server files a session under its topic's category, so that decides whether DSA problems can be logged.
  const effectiveCategory = topicOwner ?? categories.find((c) => c.id === category);
  const isDsa = effectiveCategory?.slug === DSA_SLUG;

  const submit = async () => {
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 1 || m > 1440) return setFormError('Enter between 1 and 1440 minutes.');
    const p = isDsa ? Math.round(Number(problems) || 0) : 0;
    if (p < 0 || p > 1000) return setFormError('Problems solved must be between 0 and 1000.');
    if (day > localISO()) return setFormError('Study sessions cannot be logged in the future.');
    setFormError(null);

    const saved = await run(
      () => api.sessions.create({
        topic_id: topic === '' ? null : topic,
        category_id: topic === '' && category !== '' ? category : null,
        session_date: day, minutes: m, problems_solved: p, notes: notes.trim(),
      }),
      { success: 'Study time logged', invalidate: AFTER_TIME },
    );
    if (saved) { onClose(); onSaved?.(); }
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose} size="md" title={title}
      description="Every session is saved to your account and counts toward your hours, streak and charts."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="session-form" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Log session
          </button>
        </>
      }
    >
      <form id="session-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}

        <Field label="Topic" htmlFor="sf-topic">
          <select
            id="sf-topic" className="input" value={topic}
            onChange={(e) => { setTopic(e.target.value === '' ? '' : Number(e.target.value)); if (e.target.value !== '') setCategory(''); }}
          >
            <option value="">General study (no specific topic)</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        {topic === '' && (
          <Field label="Category" htmlFor="sf-category" hint="Optional. Lets this time count toward a category's hours.">
            <select id="sf-category" className="input" value={category} onChange={(e) => setCategory(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="sf-date">
            <input id="sf-date" className="input" type="date" value={day} max={localISO()} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Minutes studied" htmlFor="sf-minutes">
            <input id="sf-minutes" className="input" type="number" min={1} max={1440} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-autofocus />
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

        {isDsa && (
          <Field label="DSA problems solved" htmlFor="sf-problems" hint="Counts toward the Problem Solver achievements.">
            <input id="sf-problems" className="input" type="number" min={0} max={1000} inputMode="numeric" value={problems} onChange={(e) => setProblems(e.target.value)} />
          </Field>
        )}

        <Field label="What did you cover?" htmlFor="sf-notes">
          <textarea id="sf-notes" className="input min-h-[4.5rem]" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
