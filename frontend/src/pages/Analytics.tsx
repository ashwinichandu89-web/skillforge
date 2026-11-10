import { Clock, Flame, Medal, TrendingDown, TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/endpoints';
import { Heatmap } from '../components/dashboard/Heatmap';
import { MonthlyChart } from '../components/dashboard/MonthlyChart';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Async } from '../components/ui/Async';
import { Card, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Segmented } from '../components/ui/Segmented';
import { useQuery } from '../hooks/useQuery';
import { ChartTooltip, SERIES, axisProps, gridProps, tooltipProps } from '../lib/chartTheme';
import { fmtHours, fmtShort } from '../lib/format';
import type { Analytics as AnalyticsData, CategoryStat } from '../types';

export default function Analytics() {
  const query = useQuery<AnalyticsData>('analytics', api.analytics);
  return (
    <>
      <PageHeader title="Analytics" subtitle="Every figure here is calculated from the topics you've completed and the study time you've logged." />
      <Async query={query}>{(d) => <Content d={d} />}</Async>
    </>
  );
}

function Stat({ icon, label, children, hint, accent }: { icon: ReactNode; label: string; children: ReactNode; hint?: string; accent: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-ink-soft">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${accent}26`, color: accent }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="h-display mt-3 text-3xl">{children}</div>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

function Content({ d }: { d: AnalyticsData }) {
  const [measure, setMeasure] = useState<'completed' | 'hours'>('completed');
  const notStarted = Math.max(0, d.total - d.completed - d.in_progress);
  const pct = (n: number) => (d.total > 0 ? (n / d.total) * 100 : 0);
  const hasAnyActivity = d.heatmap.some((x) => x.minutes > 0 || x.completions > 0);
  const byPct = [...d.categories].sort((a, b) => b.pct - a.pct || b.completed - a.completed);

  const weekly = d.weekly_hours.map((w) => ({ label: fmtShort(w.week_start), start: w.week_start, hours: Math.round(w.hours * 10) / 10 }));
  const weeklySummary = weekly.map((w) => `week of ${w.label}: ${fmtHours(w.hours)}`).join(', ');
  const totalWeekly = weekly.reduce((s, w) => s + w.hours, 0);

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <ProgressRing value={d.completion_pct} size={84} stroke={9} gradient={['#9085e9', '#22d3ee']} label={`${Math.round(d.completion_pct)} percent of the roadmap completed`}>
            <span className="h-display text-lg"><AnimatedNumber value={d.completion_pct} suffix="%" /></span>
          </ProgressRing>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Overall completion</p>
            <p className="mt-1 text-sm text-ink-soft">{d.completed} of {d.total} topics</p>
          </div>
        </Card>
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" accent="#f97316" hint={`Longest: ${d.streak.longest} ${d.streak.longest === 1 ? 'day' : 'days'}`}>
          <AnimatedNumber value={d.streak.current} /><span className="ml-1 text-base font-medium text-ink-soft">{d.streak.current === 1 ? 'day' : 'days'}</span>
        </Stat>
        <Stat icon={<Clock className="h-4 w-4" />} label="Avg. completion time" accent="#22d3ee" hint={d.avg_completion_days === null ? 'Needs a topic with both a start and a completion date.' : 'From start date to completion'}>
          {d.avg_completion_days === null
            ? <span className="text-xl font-medium text-ink-soft">Not enough data yet</span>
            : <><AnimatedNumber value={d.avg_completion_days} decimals={1} /><span className="ml-1 text-base font-medium text-ink-soft">days</span></>}
        </Stat>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Completed vs pending</p>
          <div
            className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.08]" role="img"
            aria-label={`${d.completed} completed, ${d.in_progress} in progress, ${notStarted} not started, out of ${d.total} topics`}
          >
            <div style={{ width: `${pct(d.completed)}%`, background: SERIES[1] }} />
            <div style={{ width: `${pct(d.in_progress)}%`, background: SERIES[3] }} />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-ink-soft">
            <li className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[1] }} aria-hidden />Completed</span><span className="font-semibold text-ink">{d.completed}</span></li>
            <li className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[3] }} aria-hidden />In progress</span><span className="font-semibold text-ink">{d.in_progress}</span></li>
            <li className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/20" aria-hidden />Not started</span><span className="font-semibold text-ink">{notStarted}</span></li>
          </ul>
        </Card>
      </div>

      {/* Category completion + strongest / weakest */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardTitle title="Category completion" subtitle="Share of each category's topics completed" />
          <ul className="space-y-4">
            {byPct.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden /><span className="truncate">{c.name}</span></span>
                  <span className="shrink-0 tabular-nums text-ink-soft">{c.completed}/{c.total} · <span className="font-semibold text-ink">{Math.round(c.pct)}%</span></span>
                </div>
                <ProgressBar value={c.pct} color={c.color} height="h-2.5" className="mt-1.5" label={`${c.name}: ${c.completed} of ${c.total} topics completed`} />
                <p className="mt-1 text-xs text-ink-mute">{fmtHours(c.hours)} studied{c.in_progress > 0 ? ` · ${c.in_progress} in progress` : ''}</p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid gap-4 lg:col-span-5">
          <Highlight kind="strong" category={d.strongest_category} other={d.weakest_category} count={d.categories.length} />
          <Highlight kind="weak" category={d.weakest_category} other={d.strongest_category} count={d.categories.length} />
        </div>
      </div>

      {/* Weekly + monthly */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title="Weekly study hours" subtitle={`Last ${weekly.length} weeks · ${fmtHours(totalWeekly)} total`} />
          <div role="img" aria-label={`Study hours per week. ${weeklySummary}.`} className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={44} allowDecimals />
                <Tooltip {...tooltipProps} content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} valueFormatter={(v) => fmtHours(v)} />} />
                <Bar dataKey="hours" name="Study hours" fill={SERIES[1]} radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle
            title="Monthly progress" subtitle={measure === 'completed' ? 'Topics completed per month' : 'Study hours per month'}
            action={<Segmented<'completed' | 'hours'> ariaLabel="Monthly measure" value={measure} onChange={setMeasure} options={[{ value: 'completed', label: 'Topics' }, { value: 'hours', label: 'Hours' }]} />}
          />
          <MonthlyChart months={d.monthly_progress} measure={measure} height={224} />
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardTitle title="Daily activity" subtitle="Study time per day over the last year" />
        {hasAnyActivity ? (
          <Heatmap days={d.heatmap} />
        ) : (
          <EmptyState title="No activity recorded yet" body="Log a study session and it will light up here." action={<Link to="/roadmap" className="btn-secondary">Open the roadmap</Link>} />
        )}
      </Card>
    </div>
  );
}

function Highlight({ kind, category, other, count }: { kind: 'strong' | 'weak'; category: CategoryStat | null; other: CategoryStat | null; count: number }) {
  const strong = kind === 'strong';
  const Icon = strong ? TrendingUp : TrendingDown;
  const title = strong ? 'Strongest category' : 'Needs the most attention';
  const accent = strong ? '#14b8a6' : '#f97316';

  let body: ReactNode;
  if (!category) {
    body = <p className="text-sm text-ink-soft">{strong ? 'No category has a completed topic yet. Finish one and your strongest category appears here.' : 'Categories appear here once the roadmap loads.'}</p>;
  } else if (count === 1 || (other && other.pct === category.pct)) {
    body = <p className="text-sm text-ink-soft">{count === 1 ? 'There is only one category.' : `Every category with activity is level at ${Math.round(category.pct)}%, so there is no clear ${strong ? 'leader' : 'laggard'}.`}</p>;
  } else {
    body = (
      <>
        <p className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} aria-hidden />{category.name}</p>
        <ProgressBar value={category.pct} color={category.color} className="mt-2" label={`${category.name} completion`} />
        <p className="mt-2 text-xs text-ink-soft">{Math.round(category.pct)}% complete · {category.completed}/{category.total} topics · {fmtHours(category.hours)} studied</p>
      </>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2 text-ink-soft">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${accent}26`, color: accent }}>{strong ? <Medal className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      {body}
    </Card>
  );
}
