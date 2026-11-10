import { CalendarPlus, Check, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, SkipForward, Target, Timer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/endpoints';
import { SessionFormModal } from '../components/forms/SessionFormModal';
import { DailyTargetModal } from '../components/planner/DailyTargetModal';
import { MilestoneFormModal } from '../components/planner/MilestoneFormModal';
import { daysFromToday } from '../components/planner/dates';
import { PlanFormModal } from '../components/planner/PlanFormModal';
import { Async } from '../components/ui/Async';
import { Card, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAction } from '../hooks/useAction';
import { useQuery } from '../hooks/useQuery';
import { ChartTooltip, SERIES, axisProps, gridProps, tooltipProps } from '../lib/chartTheme';
import { addDays, fmtDate, fmtHours, fmtMinutes, fmtShort, localISO, mondayOf, relativeDays } from '../lib/format';
import type { Milestone, Plan, PlannerWeek } from '../types';

type PlanStatus = Plan['status'];

export default function Planner() {
  const [start, setStart] = useState(() => mondayOf(localISO()));
  const query = useQuery<PlannerWeek>(`planner:${start}`, () => api.plans.week(start));
  const thisWeek = mondayOf(localISO());

  const [planModal, setPlanModal] = useState<{ plan: Plan | null; date?: string } | null>(null);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Study Planner"
        subtitle="Plan your week, log what you actually studied, and compare the two."
        actions={
          <>
            <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setTargetOpen(true)}><Target className="h-4 w-4" />Daily target</button>
            <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setSessionDate(localISO())}><Timer className="h-4 w-4" />Log study time</button>
            <button type="button" className="btn-primary min-h-[44px]" onClick={() => setPlanModal({ plan: null })}><Plus className="h-4 w-4" />Add study block</button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary h-11 w-11 px-0" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="btn-secondary h-11 w-11 px-0" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="h-4 w-4" /></button>
        <p className="px-2 text-sm font-semibold" aria-live="polite">{fmtShort(start)} – {fmtDate(addDays(start, 6))}</p>
        {start !== thisWeek && <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setStart(thisWeek)}>This week</button>}
      </div>

      <Async query={query}>
        {(week) => (
          <div className="space-y-4">
            <WeekSummary week={week} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {week.days.map((day) => (
                <DayCard
                  key={day.date} day={day} goal={week.daily_goal_minutes} categories={week.categories}
                  onAdd={() => setPlanModal({ plan: null, date: day.date })}
                  onLog={() => setSessionDate(day.date)}
                  onEdit={(p) => setPlanModal({ plan: p })}
                />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <CategoryHours week={week} />
              <Upcoming plans={week.upcoming} onEdit={(p) => setPlanModal({ plan: p })} />
            </div>
          </div>
        )}
      </Async>

      <Milestones />

      <PlanFormModal open={planModal !== null} onClose={() => setPlanModal(null)} plan={planModal?.plan} defaultDate={planModal?.date} />
      <SessionFormModal open={sessionDate !== null} onClose={() => setSessionDate(null)} date={sessionDate ?? undefined} />
      <DailyTargetModal open={targetOpen} onClose={() => setTargetOpen(false)} currentMinutes={query.data?.daily_goal_minutes ?? 60} />
    </>
  );
}

function WeekSummary({ week }: { week: PlannerWeek }) {
  const { planned_minutes: planned, actual_minutes: actual } = week.totals;
  const diff = actual - planned;
  const text = planned === 0
    ? 'No study blocks planned this week.'
    : diff >= 0 ? `${fmtMinutes(diff)} ahead of plan` : `${fmtMinutes(-diff)} left to match the plan`;
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><p className="label">Planned</p><p className="h-display text-2xl">{fmtMinutes(planned)}</p></div>
        <div><p className="label">Actually studied</p><p className="h-display text-2xl">{fmtMinutes(actual)}</p></div>
        <div><p className="label">Daily target</p><p className="h-display text-2xl">{fmtMinutes(week.daily_goal_minutes)}</p></div>
      </div>
      <ProgressBar value={planned > 0 ? Math.min(100, (actual / planned) * 100) : 0} color={SERIES[1]} className="mt-4" label="Actual versus planned study time" />
      <p className="mt-2 text-sm text-ink-soft">{text}</p>
    </Card>
  );
}

function DayCard({ day, goal, categories, onAdd, onLog, onEdit }: {
  day: PlannerWeek['days'][number]; goal: number; categories: PlannerWeek['categories'];
  onAdd: () => void; onLog: () => void; onEdit: (p: Plan) => void;
}) {
  const { busy, run } = useAction();
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const color = (id: number | null) => categories.find((c) => c.category_id === id)?.color ?? '#64748b';
  const setStatus = (p: Plan, status: PlanStatus) => run(() => api.plans.update(p.id, { status }), { invalidate: ['planner', 'overview'] });

  return (
    <div className={`card flex flex-col p-4 ${day.is_today ? 'ring-1 ring-brand-cyan/50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{fmtDate(day.date, { weekday: 'long' })}{day.is_today && <span className="ml-2 rounded-md bg-brand-cyan/15 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-brand-cyan">Today</span>}</p>
          <p className="text-xs text-ink-mute">{fmtShort(day.date)}</p>
        </div>
        <p className="text-right text-xs text-ink-soft">{fmtMinutes(day.actual_minutes)}<br /><span className="text-ink-mute">of {fmtMinutes(goal)}</span></p>
      </div>
      <ProgressBar value={goal > 0 ? Math.min(100, (day.actual_minutes / goal) * 100) : 0} color={SERIES[1]} height="h-1.5" className="mt-2" label={`${fmtDate(day.date, { weekday: 'long' })}: ${fmtMinutes(day.actual_minutes)} of ${fmtMinutes(goal)} target`} />

      <ul className="mt-3 flex-1 space-y-2">
        {day.plans.map((p) => (
          <li key={p.id} className="rounded-xl bg-white/[0.04] p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color(p.category_id) }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${p.status !== 'planned' ? 'text-ink-mute line-through' : ''}`}>{p.title}</p>
                <p className="text-xs text-ink-mute">
                  {fmtMinutes(p.planned_minutes)}{p.status !== 'planned' && ` · ${p.status}`}
                  {p.deadline && ` · due ${fmtShort(p.deadline)}`}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex gap-1">
              {p.status === 'planned' ? (
                <>
                  <button type="button" className="btn-ghost h-9 px-2 text-xs" disabled={busy} onClick={() => void setStatus(p, 'done')} aria-label={`Mark ${p.title} done`}><Check className="h-3.5 w-3.5" />Done</button>
                  <button type="button" className="btn-ghost h-9 px-2 text-xs" disabled={busy} onClick={() => void setStatus(p, 'skipped')} aria-label={`Skip ${p.title}`}><SkipForward className="h-3.5 w-3.5" />Skip</button>
                </>
              ) : (
                <button type="button" className="btn-ghost h-9 px-2 text-xs" disabled={busy} onClick={() => void setStatus(p, 'planned')} aria-label={`Re-plan ${p.title}`}><RotateCcw className="h-3.5 w-3.5" />Re-plan</button>
              )}
              <button type="button" className="btn-ghost ml-auto h-9 w-9 px-0" onClick={() => onEdit(p)} aria-label={`Edit ${p.title}`}><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" className="btn-ghost h-9 w-9 px-0" onClick={() => setDeleting(p)} aria-label={`Delete ${p.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
        {day.sessions.map((s) => (
          <li key={`s${s.id}`} className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-2.5 py-2 text-xs text-ink-soft">
            <Timer className="h-3.5 w-3.5 shrink-0 text-brand-teal" aria-hidden /><span>Studied {fmtMinutes(s.minutes)}</span>{s.notes && <span className="truncate text-ink-mute">· {s.notes}</span>}
          </li>
        ))}
        {day.plans.length === 0 && day.sessions.length === 0 && <li className="text-xs text-ink-mute">Nothing planned.</li>}
      </ul>

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-secondary h-10 flex-1 text-xs" onClick={onAdd}><CalendarPlus className="h-3.5 w-3.5" />Plan</button>
        <button type="button" className="btn-secondary h-10 flex-1 text-xs" onClick={onLog}><Timer className="h-3.5 w-3.5" />Log</button>
      </div>

      <ConfirmDialog
        open={deleting !== null} title="Delete study block?" message={<>"{deleting?.title}" will be removed from your plan.</>} confirmLabel="Delete" danger busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void run(() => api.plans.remove(deleting.id), { success: 'Study block deleted', invalidate: ['planner'], onDone: () => setDeleting(null) }); }}
      />
    </div>
  );
}

function CategoryHours({ week }: { week: PlannerWeek }) {
  const rows = week.categories.map((c) => ({ name: c.name, planned: Math.round((c.planned_minutes / 60) * 10) / 10, actual: Math.round((c.actual_minutes / 60) * 10) / 10 }));
  const active = rows.filter((r) => r.planned > 0 || r.actual > 0);
  const summary = active.map((r) => `${r.name}: planned ${fmtHours(r.planned)}, actual ${fmtHours(r.actual)}`).join('; ');
  return (
    <Card>
      <CardTitle title="Hours by category" subtitle="Planned versus actual this week" />
      {active.length === 0 ? (
        <EmptyState title="Nothing allocated yet" body="Add a study block with a category to allocate hours." />
      ) : (
        <div role="img" aria-label={`Hours by category. ${summary}.`} style={{ height: Math.max(180, active.length * 54) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={active} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals />
              <YAxis type="category" dataKey="name" {...axisProps} width={96} />
              <Tooltip {...tooltipProps} content={<ChartTooltip valueFormatter={(v) => fmtHours(v)} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="planned" name="Planned" fill={SERIES[0]} radius={[0, 6, 6, 0]} barSize={10} />
              <Bar dataKey="actual" name="Actual" fill={SERIES[1]} radius={[0, 6, 6, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function Upcoming({ plans, onEdit }: { plans: Plan[]; onEdit: (p: Plan) => void }) {
  return (
    <Card>
      <CardTitle title="Upcoming tasks" subtitle="Planned blocks and deadlines, soonest first" />
      {plans.length === 0 ? (
        <EmptyState title="Nothing upcoming" body="Planned study blocks will be listed here." />
      ) : (
        <ul className="space-y-2">
          {plans.map((p) => {
            const due = p.deadline ?? p.plan_date;
            const n = daysFromToday(due);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onEdit(p)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.title}</span><span className="text-xs text-ink-mute">{fmtMinutes(p.planned_minutes)} · {p.deadline ? 'due' : 'planned'} {fmtDate(due, { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
                  <span className={`shrink-0 text-xs font-semibold ${n < 0 ? 'text-brand-orange' : 'text-ink-soft'}`}>{n < 0 ? `overdue · ${relativeDays(n)}` : relativeDays(n)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Milestones() {
  const query = useQuery<Milestone[]>('milestones', api.milestones.list);
  const { busy, run } = useAction();
  const [edit, setEdit] = useState<{ m: Milestone | null } | null>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  return (
    <Card className="mt-4">
      <CardTitle
        title="Milestones" subtitle="Dated goals that appear on your Overview"
        action={<button type="button" className="btn-secondary min-h-[40px]" onClick={() => setEdit({ m: null })}><Plus className="h-4 w-4" />Add milestone</button>}
      />
      <Async query={query}>
        {(items) => items.length === 0 ? (
          <EmptyState title="No milestones yet" body="Set a dated goal such as “Finish AWS fundamentals by 30 Nov”." action={<button type="button" className="btn-primary" onClick={() => setEdit({ m: null })}>Add milestone</button>} />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((m) => {
              const done = m.completed_at !== null;
              const n = daysFromToday(m.target_date);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-ink-mute line-through' : ''}`}>{m.title}</p>
                    <p className={`text-xs ${!done && n < 0 ? 'text-brand-orange' : 'text-ink-mute'}`}>
                      {done ? `Completed ${fmtDate(m.completed_at)}` : `${fmtDate(m.target_date)} · ${n < 0 ? 'overdue, ' : ''}${relativeDays(n)}`}
                    </p>
                    {m.description && <p className="mt-0.5 text-xs text-ink-soft">{m.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost h-10 px-3 text-xs" disabled={busy} onClick={() => void run(() => api.milestones.update(m.id, { completed: !done }), { invalidate: ['milestones', 'overview'] })}>
                      {done ? <><RotateCcw className="h-3.5 w-3.5" />Undo</> : <><Check className="h-3.5 w-3.5" />Complete</>}
                    </button>
                    <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={() => setEdit({ m })} aria-label={`Edit ${m.title}`}><Pencil className="h-4 w-4" /></button>
                    <button type="button" className="btn-ghost h-10 w-10 px-0" onClick={() => setDeleting(m)} aria-label={`Delete ${m.title}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <MilestoneFormModal open={edit !== null} onClose={() => setEdit(null)} milestone={edit?.m} />
      <ConfirmDialog
        open={deleting !== null} title="Delete milestone?" message={<>"{deleting?.title}" will be removed.</>} confirmLabel="Delete" danger busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void run(() => api.milestones.remove(deleting.id), { success: 'Milestone deleted', invalidate: ['milestones', 'overview'], onDone: () => setDeleting(null) }); }}
      />
    </Card>
  );
}

