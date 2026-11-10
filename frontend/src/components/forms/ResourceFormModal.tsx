import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/endpoints';
import { useAction } from '../../hooks/useAction';
import { useRoadmapWhen } from '../../hooks/useRoadmap';
import { KIND_LABEL } from '../../lib/format';
import type { Resource, ResourceKind } from '../../types';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

/** What the form needs to edit. Both the list endpoint's Resource and a topic's UserResource fit. */
export type EditableResource = Pick<Resource, 'id' | 'title' | 'kind' | 'url' | 'notes' | 'filename'> & {
  has_file?: boolean; topic_id?: number | null; category_id?: number | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode. */
  resource?: EditableResource | null;
  defaultTopicId?: number | null;
  defaultCategoryId?: number | null;
  onSaved?: (r: Resource) => void;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024; // mirrors the server's limit; the server enforces it too

/** Uploads straight to S3 with the presigned POST the API hands out, so file bytes never pass through the API. */
async function uploadPdf(file: File): Promise<{ s3_key: string; filename: string }> {
  const target = await api.resources.uploadUrl(file.name);
  if (file.size > target.max_bytes) throw new Error(`That file is larger than ${Math.round(target.max_bytes / 1048576)} MB.`);
  const form = new FormData();
  Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file); // S3 requires the file to be the last field
  let res: Response;
  try {
    res = await fetch(target.url, { method: 'POST', body: form });
  } catch {
    throw new Error("Couldn't reach file storage. Check your connection (and the bucket's CORS settings) and try again.");
  }
  if (!res.ok) throw new Error(`The upload was rejected (${res.status}). Only PDFs up to ${Math.round(target.max_bytes / 1048576)} MB are accepted.`);
  return { s3_key: target.s3_key, filename: target.filename };
}

export function ResourceFormModal({ open, onClose, resource, defaultTopicId, defaultCategoryId, onSaved }: Props) {
  const editing = !!resource;
  const { busy, run } = useAction();
  const roadmap = useRoadmapWhen(open);
  const categories = roadmap.data ?? [];

  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ResourceKind>('docs');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);

  const topicsInCategory = useMemo(
    () => (categoryId === '' ? [] : categories.find((c) => c.id === categoryId)?.topics ?? []),
    [categories, categoryId],
  );

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setFile(null);
    setTitle(resource?.title ?? '');
    setKind(resource?.kind ?? 'docs');
    setUrl(resource?.url ?? '');
    setNotes(resource?.notes ?? '');
    setTopicId(resource?.topic_id ?? defaultTopicId ?? '');
    setCategoryId(resource?.category_id ?? defaultCategoryId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource?.id]);

  // When only a topic is known (e.g. opened from a topic page), derive its category once the roadmap arrives.
  useEffect(() => {
    if (topicId === '' || categoryId !== '' || categories.length === 0) return;
    const owner = categories.find((c) => c.topics.some((t) => t.id === topicId));
    if (owner) setCategoryId(owner.id);
  }, [categories, topicId, categoryId]);

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return setFormError('Give the resource a title.');
    const cleanUrl = url.trim();
    if (cleanUrl && !/^https?:\/\/\S+$/i.test(cleanUrl)) return setFormError('The link must start with http:// or https:// and contain no spaces.');
    if (file && file.size > MAX_PDF_BYTES) return setFormError('PDFs can be at most 25 MB.');
    if (file && !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return setFormError('Only PDF files can be uploaded.');
    if (!cleanUrl && !file && !notes.trim() && !resource?.has_file) return setFormError('Add a link, upload a PDF, or write some notes.');
    setFormError(null);

    const links = { topic_id: topicId === '' ? null : topicId, category_id: categoryId === '' ? null : categoryId };
    const saved = await run<Resource>(async () => {
      if (editing && resource) {
        const body: Record<string, unknown> = { title: cleanTitle, kind, notes, ...links };
        if (cleanUrl) body.url = cleanUrl; // the API cannot clear a link; deleting the resource does that
        return api.resources.update(resource.id, body);
      }
      const uploaded = file ? await uploadPdf(file) : null;
      return api.resources.create({
        title: cleanTitle, kind, notes, ...links,
        url: cleanUrl || null, s3_key: uploaded?.s3_key ?? null, filename: uploaded?.filename ?? null,
      });
    }, { success: editing ? 'Resource updated' : 'Resource saved', invalidate: ['resources', 'topic'] });
    if (saved) { onClose(); onSaved?.(saved); }
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose}
      title={editing ? 'Edit resource' : 'Add a resource'}
      description="Save tutorials, docs, repos, courses, PDFs and reference material against a category or topic."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="resource-form" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save changes' : file ? 'Upload and save' : 'Save resource'}
          </button>
        </>
      }
    >
      <form id="resource-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}

        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Field label="Title" htmlFor="rf-title">
            <input id="rf-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FastAPI official tutorial" />
          </Field>
          <Field label="Type" htmlFor="rf-kind">
            <select id="rf-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
              {(Object.keys(KIND_LABEL) as ResourceKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Link" htmlFor="rf-url" hint={editing ? 'Leave blank to keep the current link.' : undefined}>
          <input id="rf-url" className="input" type="url" inputMode="url" value={url} maxLength={1000} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </Field>

        {kind === 'pdf' && (
          editing ? (
            resource?.has_file && <p className="text-sm text-ink-soft">Uploaded file: <span className="font-semibold text-ink">{resource.filename}</span>. To replace it, add a new resource.</p>
          ) : (
            <Field label="PDF file" htmlFor="rf-file" hint="Optional. Up to 25 MB. Stored privately; only you can download it.">
              <input
                id="rf-file" type="file" accept="application/pdf,.pdf"
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-white/[0.12]"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          )
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="rf-category">
            <select
              id="rf-category" className="input" value={categoryId}
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
          <Field label="Topic" htmlFor="rf-topic">
            <select
              id="rf-topic" className="input" value={topicId} disabled={categoryId === ''}
              onChange={(e) => setTopicId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{categoryId === '' ? 'Pick a category first' : 'Whole category'}</option>
              {topicsInCategory.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="rf-notes" hint="Why you saved it, or the key takeaways. Notes alone are enough for personal reference material.">
          <textarea id="rf-notes" className="input min-h-[5rem]" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {roadmap.error && !roadmap.data && <p className="text-xs text-brand-orange">Couldn't load categories. You can still save without one.</p>}
      </form>
    </Modal>
  );
}
