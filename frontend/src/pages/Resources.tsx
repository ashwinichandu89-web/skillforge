import { Download, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/endpoints';
import { KindIcon } from '../components/icons';
import { ResourceFormModal } from '../components/forms/ResourceFormModal';
import { Async } from '../components/ui/Async';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAction } from '../hooks/useAction';
import { useQuery } from '../hooks/useQuery';
import { useRoadmap } from '../hooks/useRoadmap';
import { KIND_LABEL } from '../lib/format';
import type { Resource, ResourceKind, RoadmapCategory } from '../types';

const KINDS = Object.keys(KIND_LABEL) as ResourceKind[];

const host = (url: string | null): string => {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

export default function Resources() {
  const roadmap = useRoadmap();
  const categories = roadmap.data ?? [];
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [kind, setKind] = useState<ResourceKind | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [form, setForm] = useState<{ resource: Resource | null } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const filters = {
    q: debouncedQ || undefined, kind: kind || undefined,
    category_id: categoryId === '' ? undefined : categoryId, topic_id: topicId === '' ? undefined : topicId,
  };
  const query = useQuery<Resource[]>(`resources:${JSON.stringify(filters)}`, () => api.resources.list(filters));
  const topics = categories.find((c) => c.id === categoryId)?.topics ?? [];
  const anyFilter = !!(debouncedQ || kind || categoryId !== '' || topicId !== '');

  return (
    <>
      <PageHeader
        title="Resource Library" subtitle="Tutorials, docs, repos, courses, PDFs and reference notes, organised by category and topic."
        actions={<button type="button" className="btn-primary min-h-[44px]" onClick={() => setForm({ resource: null })}><Plus className="h-4 w-4" />Add resource</button>}
      />

      <div className="card mb-4 space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input className="input min-h-[44px] pl-9" type="search" placeholder="Search titles and notes" aria-label="Search resources" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="input min-h-[44px]" aria-label="Filter by category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value === '' ? '' : Number(e.target.value)); setTopicId(''); }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input min-h-[44px]" aria-label="Filter by topic" value={topicId} disabled={categoryId === ''} onChange={(e) => setTopicId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">{categoryId === '' ? 'Choose a category for topics' : 'All topics'}</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {[''as const, ...KINDS].map((k) => (
            <button
              key={k || 'all'} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${kind === k ? 'bg-brand-purple text-white' : 'bg-white/[0.06] text-ink-soft hover:bg-white/[0.1]'}`}
            >
              {k && <KindIcon kind={k} className="h-3.5 w-3.5" />}{k ? KIND_LABEL[k] : 'All types'}
            </button>
          ))}
        </div>
        {anyFilter && <button type="button" className="btn-ghost h-9 text-xs" onClick={() => { setQ(''); setKind(''); setCategoryId(''); setTopicId(''); }}>Clear filters</button>}
      </div>

      <Async query={query}>
        {(items) => items.length === 0 ? (
          anyFilter ? (
            <EmptyState title="No resources match" body="Try different filters or clear them." />
          ) : (
            <EmptyState
              title="Your library is empty" body="Save YouTube tutorials, documentation links, GitHub repositories, courses, PDF notes and personal reference material, then find them by category or topic."
              action={<button type="button" className="btn-primary" onClick={() => setForm({ resource: null })}>Add your first resource</button>}
            />
          )
        ) : (
          <Groups items={items} categories={categories} onEdit={(r) => setForm({ resource: r })} total={items.length} filtered={anyFilter} />
        )}
      </Async>

      <ResourceFormModal open={form !== null} onClose={() => setForm(null)} resource={form?.resource} defaultCategoryId={categoryId === '' ? null : categoryId} defaultTopicId={topicId === '' ? null : topicId} />
    </>
  );
}

function Groups({ items, categories, onEdit, total, filtered }: { items: Resource[]; categories: RoadmapCategory[]; onEdit: (r: Resource) => void; total: number; filtered: boolean }) {
  const groups = useMemo(() => {
    const out: { key: string; name: string; color: string; sections: { key: string; title: string | null; items: Resource[] }[] }[] = [];
    const catOf = (r: Resource) => r.category_id ?? categories.find((c) => c.topics.some((t) => t.id === r.topic_id))?.id ?? null;
    const ids = [...categories.map((c) => c.id), null];
    for (const id of ids) {
      const inCat = items.filter((r) => catOf(r) === id);
      if (!inCat.length) continue;
      const cat = categories.find((c) => c.id === id);
      const sections: { key: string; title: string | null; items: Resource[] }[] = [];
      const general = inCat.filter((r) => r.topic_id === null);
      if (general.length) sections.push({ key: 'general', title: null, items: general });
      for (const t of cat?.topics ?? []) {
        const ofTopic = inCat.filter((r) => r.topic_id === t.id);
        if (ofTopic.length) sections.push({ key: `t${t.id}`, title: t.title, items: ofTopic });
      }
      out.push({ key: String(id), name: cat?.name ?? 'General', color: cat?.color ?? '#64748b', sections });
    }
    return out;
  }, [items, categories]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">{total} {total === 1 ? 'resource' : 'resources'}{filtered ? ' match your filters' : ' saved'}.</p>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.name}>
          <h2 className="h-display mb-3 flex items-center gap-2 text-base"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} aria-hidden />{g.name}</h2>
          <div className="space-y-4">
            {g.sections.map((s) => (
              <div key={s.key}>
                {s.title && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">{s.title}</h3>}
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{s.items.map((r) => <li key={r.id}><ResourceCard r={r} onEdit={() => onEdit(r)} /></li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ResourceCard({ r, onEdit }: { r: Resource; onEdit: () => void }) {
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);

  const download = () => run(() => api.resources.downloadUrl(r.id), { onDone: (res) => { window.open(res.url, '_blank', 'noopener'); } });

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-brand-cyan"><KindIcon kind={r.kind} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold">{r.title}</p>
          <p className="text-xs text-ink-mute">{KIND_LABEL[r.kind]}{r.url ? ` · ${host(r.url)}` : ''}{r.filename ? ` · ${r.filename}` : ''}</p>
        </div>
      </div>
      {r.notes && <p className="mt-2 line-clamp-3 text-xs text-ink-soft">{r.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1 pt-1">
        {r.url && <a className="btn-secondary h-9 px-3 text-xs" href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open</a>}
        {r.has_file && <button type="button" className="btn-secondary h-9 px-3 text-xs" disabled={busy} onClick={() => void download()}><Download className="h-3.5 w-3.5" />Download</button>}
        <button type="button" className="btn-ghost ml-auto h-9 w-9 px-0" onClick={onEdit} aria-label={`Edit ${r.title}`}><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" className="btn-ghost h-9 w-9 px-0" onClick={() => setConfirm(true)} aria-label={`Delete ${r.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <ConfirmDialog
        open={confirm} title="Delete resource?" message={<>"{r.title}" will be removed from your library{r.has_file ? ' and its file deleted' : ''}.</>} confirmLabel="Delete" danger busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void run(() => api.resources.remove(r.id), { success: 'Resource deleted', invalidate: ['resources', 'topic'], onDone: () => setConfirm(false) })}
      />
    </Card>
  );
}
