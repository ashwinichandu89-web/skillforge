import { ArrowRight, Map as MapIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { Async } from '../components/ui/Async';
import { StatusBadge } from '../components/ui/Badge';
import { Card, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { flattenTopics, getLastTopic, useRoadmap } from '../hooks/useRoadmap';
import type { RoadmapCategory, TopicSummary } from '../types';

/**
 * "Topic Workspace" in the sidebar. Resumes the topic you were last in; if there is none yet,
 * offers the topics you have started and the high-priority ones to pick up next.
 */
export default function TopicsIndex() {
  const roadmap = useRoadmap();
  return <Async query={roadmap}>{(rm) => <Landing roadmap={rm} />}</Async>;
}

function Landing({ roadmap }: { roadmap: RoadmapCategory[] }) {
  const all = flattenTopics(roadmap);
  const last = getLastTopic();
  if (last !== null && all.some((t) => t.id === last)) return <Navigate to={`/topics/${last}`} replace />;

  const colorOf = (t: TopicSummary) => roadmap.find((c) => c.id === t.category_id)?.color ?? '#8b5cf6';
  const started = all.filter((t) => t.status === 'in_progress');
  const next = all.filter((t) => t.status === 'not_started' && t.priority === 'high').slice(0, 6);

  const row = (t: TopicSummary) => (
    <li key={t.id}>
      <Link to={`/topics/${t.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05]">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(t) }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{t.title}</span>
          <ProgressBar value={t.progress_pct} color={colorOf(t)} height="h-1" className="mt-1.5" label={`${t.title} progress`} />
        </span>
        <StatusBadge status={t.status} />
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden />
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader title="Topic Workspace" subtitle="Pick a topic to open its objectives, exercises, resources and notes." actions={<Link to="/roadmap" className="btn-secondary"><MapIcon className="h-4 w-4" />Browse the roadmap</Link>} />
      {started.length === 0 && next.length === 0 ? (
        <EmptyState title="Nothing started yet" body="Open the roadmap, choose a topic and press Start Learning. It will appear here." action={<Link to="/roadmap" className="btn-primary">Open the roadmap</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle title="In progress" subtitle="Topics you've started" />
            {started.length ? <ul className="space-y-1">{started.map(row)}</ul> : <p className="text-sm text-ink-soft">No topic in progress. Start one from the list.</p>}
          </Card>
          <Card>
            <CardTitle title="Up next" subtitle="High-priority topics not started yet" />
            {next.length ? <ul className="space-y-1">{next.map(row)}</ul> : <p className="text-sm text-ink-soft">No high-priority topics waiting. Set priorities from the roadmap.</p>}
          </Card>
        </div>
      )}
    </>
  );
}
