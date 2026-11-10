import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/endpoints';
import { useAction } from '../../hooks/useAction';
import { useRoadmapWhen } from '../../hooks/useRoadmap';
import type { Milestone } from '../../types';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode. */
  milestone?: Milestone | null;
}

/** Add or edit a dated goal ("Finish the AWS fundamentals by 30 Nov"). */
export function MilestoneFormModal({ open, onClose, milestone }: Props) {
  const editing = !!milestone;
  const { busy, run } = useAction();
  const roadmap = useRoadmapWhen(open);
  const categories = roadmap.data ?? [];

  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setTitle(milestone?.title ?? '');
    setDescription(milestone?.description ?? '');
    setTargetDate(milestone?.target_date ?? '');
    setCategoryId(milestone?.category_id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  // The API can change a milestone's category but cannot remove it, so "No category" is only offered when there is none.
  const canClearCategory = !milestone?.category_id;

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return setFormError('Give the milestone a title.');
    if (!targetDate) return setFormError('Choose a target date.');
    setFormError(null);

    const saved = await run<Milestone>(
      () => {
        if (editing && milestone) {
          const body: Record<string, unknown> = { title: cleanTitle, description: description.trim(), target_date: targetDate };
          if (categoryId !== '') body.category_id = categoryId;
          return api.milestones.update(milestone.id, body);
        }
        return api.milestones.create({
          title: cleanTitle, description: description.trim(), target_date: targetDate,
          category_id: categoryId === '' ? null : categoryId,
        });
      },
      { success: editing ? 'Milestone updated' : 'Milestone added', invalidate: ['milestones', 'overview'] },
    );
    if (saved) onClose();
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose}
      title={editing ? 'Edit milestone' : 'Add a milestone'}
      description="A dated goal. Upcoming milestones appear on your Overview."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="milestone-form" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Add milestone'}
          </button>
        </>
      }
    >
      <form id="milestone-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}

        <Field label="Title" htmlFor="mf-title">
          <input id="mf-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deploy SkillForge to AWS" data-autofocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target date" htmlFor="mf-date">
            <input id="mf-date" className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="mf-category" hint="Optional.">
            <select id="mf-category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}>
              {canClearCategory && <option value="">No category</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description" htmlFor="mf-description">
          <textarea id="mf-description" className="input min-h-[4.5rem]" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
