import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Flame, Hourglass, Layers, ListChecks, Timer, Trophy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/endpoints';
import { SessionFormModal } from '../components/forms/SessionFormModal';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Async } from '../components/ui/Async';
import { Card, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Segmented } from '../components/ui/Segmented';
import { MonthlyChart } from '../components/dashboard/MonthlyChart';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import { ChartTooltip, SERIES, axisProps, gridProps, tooltipProps } from '../lib/chartTheme';
import { fmtDate, fmtMinutes, fmtWeekday, greeting, relativeDays } from '../lib/format';
import type { FocusTopic, Overview as OverviewData } from '../types';

export default function Overview() {
  const { user } = useAuth();
  const query = useQuery<OverviewData>('overview', api.overview);
  const [logOpen, setLogOpen] = useState(false);
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] ?? '';

  return (
    <>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle={query.data ? <TodayLine data={query.data} /> : 'Here is where your Solution Engineer roadmap stands.'}
        actions={<button type="button" className="btn-primary min-h-[44px]" onClick={() => setLogOpen(true)}><Timer className="h-4 w-4" />Log study time</button>}
      />
      <Async query={query}>{(data) => <Dashboard data={data} />}</Async>
      <SessionFormModal open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function TodayLine({ data }: { data: OverviewData }) {
  const { today_minutes: done, daily_goal_minutes: goal } = data;
  if (done >= goal) return <>You've hit today's goal of {fmtMinutes(goal)} ({fmtMinutes(done)} studied).</>;
  if (done === 0) return <>Nothing logged today yet. Your daily goal is {fmtMinutes(goal)}.</>;
  return <>{fmtMinutes(done)} of today's {fmtMinutes(goal)} goal done.</>;
}

function StatCard({ icon, label, children, hint, accent }: { icon: ReactNode; label: string; children: ReactNode; hint?: string; accent: string }) {
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} aria-hidden />
      <div className="flex items-center gap-2 text-ink-soft">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${accent}26`, color: accent }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="h-display mt-3 text-3xl">{children}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

function Dashboard({ data }: { data: OverviewData }) {
  const reduce = useReducedMotion();
  const { totals, streak, level, weekly_activity: week } = data;
  const isNew = totals.completed === 0 && totals.in_progress === 0 && data.study_hours === 0;
  const todayKey = data.today;

  return (
    <div className="space-y-4">
      {isNew && (
        <Card glass className="border-brand-purple/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="h-display text-lg">Start your roadmap</h2>
              <p className="mt-1 max-w-xl text-sm text-ink-soft">Open the roadmap, choose a topic and press Start Learning. Then log your study time here. Everything on this page fills in from the work you record.</p>
            </div>
            <Link to="/roadmap" className="btn-primary min-h-[44px] shrink-0">Open the roadmap<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Completion hero */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-5 bg-gradient-to-br from-brand-purple/20 via-navy-800 to-navy-800 p-5 sm:gap-7 sm:p-6 lg:col-span-5">
          <ProgressRing value={totals.completion_pct} size={132} stroke={13} gradient={['#9085e9', '#22d3ee']} label={`${Math.round(totals.completion_pct)} percent of the roadmap completed`}>
            <div>
              <p className="h-display text-3xl"><AnimatedNumber value={totals.completion_pct} decimals={0} suffix="%" /></p>
              <p className="text-[0.65rem] uppercase tracking-wide text-ink-mute">complete</p>
            </div>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Roadmap progress</p>
            <p className="h-display mt-1 text-xl">{totals.completed} of {totals.topics} topics</p>
            <p className="mt-1 text-sm text-ink-soft">{totals.in_progress > 0 ? `${totals.in_progress} in progress.` : 'Nothing in progress right now.'}</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-brand-orange" aria-hidden />
              <span>Level {level.level} · {level.title}</span>
            </div>
            <ProgressBar value={level.progress * 100} color="#f59e0b" height="h-1.5" className="mt-2" label={`Progress to level ${level.level + 1}`} />
            <p className="mt-1 text-xs text-ink-mute">{level.xp_into_level} / {level.xp_for_next} XP to next level</p>
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-7">
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" accent="#14b8a6"><AnimatedNumber value={totals.completed} /></StatCard>
          <StatCard icon={<ListChecks className="h-4 w-4" />} label="Remaining" accent="#22d3ee"><AnimatedNumber value={totals.remaining} /></StatCard>
          <StatCard icon={<Layers className="h-4 w-4" />} label="Categories" accent="#8b5cf6"><AnimatedNumber value={totals.categories} /></StatCard>
          <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" accent="#f97316" hint={`Longest: ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}`}>
            <AnimatedNumber value={streak.current} /><span className="ml-1 text-base font-medium text-ink-soft">{streak.current === 1 ? 'day' : 'days'}</span>
          </StatCard>
          <StatCard icon={<Hourglass className="h-4 w-4" />} label="Study hours" accent="#22d3ee"><AnimatedNumber value={data.study_hours} decimals={1} /><span className="ml-1 text-base font-medium text-ink-soft">h</span></StatCard>
          <StatCard icon={<Trophy className="h-4 w-4" />} label="XP" accent="#f59e0b" hint={`Level ${level.level}`}><AnimatedNumber value={level.xp} /></StatCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardTitle title="This week" subtitle="Minutes studied per day" />
          <WeeklyChart data={week} today={todayKey} goal={data.daily_goal_minutes} />
        </Card>
        <MonthlyCard className="lg:col-span-7" months={data.monthly_progress} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardTitle title="Current learning focus" subtitle="Where to spend your next session" icon={<BookOpen className="h-4 w-4" />} />
          {data.current_focus.length === 0 ? (
            <EmptyState title="No topic in progress" body="Pick a topic from the roadmap and press Start Learning." action={<Link to="/roadmap" className="btn-secondary">Open the roadmap</Link>} />
          ) : (
            <ul className="space-y-1">{data.current_focus.map((t) => <TopicLine key={t.id} topic={t} right={<span className="text-xs text-ink-soft">{Math.round(t.progress_pct)}%</span>} progress />)}</ul>
          )}
        </Card>

        <Card className="lg:col-span-4">
          <CardTitle title="Recently completed" icon={<CheckCircle2 className="h-4 w-4" />} />
          {data.recent_completed.length === 0 ? (
            <EmptyState title="Nothing completed yet" body="Completed topics show up here once you confirm them on a topic page." />
          ) : (
            <ul className="space-y-1">{data.recent_completed.map((t) => <TopicLine key={t.id} topic={t} right={<span className="text-xs text-ink-mute">{fmtDate(t.completed_date, { day: 'numeric', month: 'short' })}</span>} />)}</ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardTitle title="Upcoming milestones" icon={<CalendarClock className="h-4 w-4" />} />
          {data.upcoming_milestones.length === 0 ? (
            <EmptyState title="No milestones" body="Set a dated goal to stay on track." action={<Link to="/planner" className="btn-secondary">Open the planner</Link>} />
          ) : (
            <ul className="space-y-3">
              {data.upcoming_milestones.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className={`text-xs ${m.days_left < 0 ? 'text-brand-orange' : 'text-ink-mute'}`}>
                    {fmtDate(m.target_date)} · {m.days_left < 0 ? `overdue (${relativeDays(m.days_left)})` : relativeDays(m.days_left)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.weekly_challenges.length > 0 && (
        <Card>
          <CardTitle title="Weekly challenges" subtitle="Reset every Monday" action={<Link to="/achievements" className="text-xs font-semibold text-brand-cyan hover:underline">All achievements</Link>} />
          <ul className="grid gap-4 sm:grid-cols-3">
            {data.weekly_challenges.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className={c.done ? 'text-brand-teal' : 'text-ink-mute'}>{c.done ? 'Done' : `${c.progress}/${c.target}`}</span>
                </div>
                <ProgressBar value={c.target > 0 ? (c.progress / c.target) * 100 : 0} color={c.done ? '#14b8a6' : '#9085e9'} className="mt-2" label={`${c.name}: ${c.progress} of ${c.target}`} />
                <p className="mt-1 text-xs text-ink-mute">{c.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TopicLine({ topic, right, progress = false }: { topic: FocusTopic; right: ReactNode; progress?: boolean }) {
  const color = topic.category_color ?? '#8b5cf6';
  return (
    <li>
      <Link to={`/topics/${topic.id}`} className="block rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60">
        <span className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{topic.title}</span>
            {topic.category_name && <span className="block truncate text-xs text-ink-mute">{topic.category_name}</span>}
          </span>
          {right}
        </span>
        {progress && <ProgressBar value={topic.progress_pct} color={color} height="h-1" className="mt-2" label={`${topic.title} progress`} />}
      </Link>
    </li>
  );
}

function WeeklyChart({ data, today, goal }: { data: OverviewData['weekly_activity']; today: string; goal: number }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const rows = data.map((d) => ({ day: fmtWeekday(d.date), date: d.date, minutes: d.minutes }));
  const summary = rows.map((r) => `${r.day}: ${fmtMinutes(r.minutes)}`).join(', ');
  return (
    <>
      <div role="img" aria-label={`Minutes studied per day this week. ${summary}.`} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} width={44} />
            <Tooltip {...tooltipProps} content={<ChartTooltip labelFormatter={(_l, p) => fmtDate(p[0]?.payload?.date as string, { weekday: 'long', day: 'numeric', month: 'short' })} valueFormatter={(v) => fmtMinutes(v)} />} />
            <Bar dataKey="minutes" name="Studied" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {rows.map((r) => <Cell key={r.date} fill={r.date === today ? SERIES[1] : SERIES[0]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-mute">{fmtMinutes(total)} in the last 7 days · today highlighted · daily goal {fmtMinutes(goal)}</p>
    </>
  );
}

type Measure = 'completed' | 'hours';

function MonthlyCard({ months, className = '' }: { months: OverviewData['monthly_progress']; className?: string }) {
  const [measure, setMeasure] = useState<Measure>('completed');
  return (
    <Card className={className}>
      <CardTitle
        title="Monthly progress" subtitle={measure === 'completed' ? 'Topics completed per month' : 'Study hours per month'}
        action={<Segmented<Measure> ariaLabel="Monthly measure" value={measure} onChange={setMeasure} options={[{ value: 'completed', label: 'Topics' }, { value: 'hours', label: 'Hours' }]} />}
      />
      <MonthlyChart months={months} measure={measure} />
    </Card>
  );
}
