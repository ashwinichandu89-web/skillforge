import { motion, useReducedMotion } from 'framer-motion';
import { Check, CheckCircle2, Flame, Lock, Timer, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import { SessionFormModal } from '../components/forms/SessionFormModal';
import { NamedIcon } from '../components/icons';
import { Async } from '../components/ui/Async';
import { Card, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ProgressRing } from '../components/ui/ProgressRing';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Segmented } from '../components/ui/Segmented';
import { useQuery } from '../hooks/useQuery';
import { fmtMinutes } from '../lib/format';
import type { AchievementsView, Challenge } from '../types';

type Filter = 'all' | 'unlocked' | 'locked';

const LEVEL_KEY = 'sf:lastLevel';
const readLastLevel = (): number | null => {
  try {
    const raw = localStorage.getItem(LEVEL_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
};
const storeLevel = (n: number) => { try { localStorage.setItem(LEVEL_KEY, String(n)); } catch { /* convenience only */ } };

/** unlocked_at is a full timestamp; show it in the viewer's own timezone. */
const fmtStamp = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function Achievements() {
  const query = useQuery<AchievementsView>('achievements', api.achievements);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Achievements"
        subtitle="XP, streaks and badges earned from the work you actually do."
        actions={<button type="button" className="btn-primary min-h-[44px]" onClick={() => setLogOpen(true)}><Timer className="h-4 w-4" />Log study time</button>}
      />
      <Async query={query}>{(view) => <Content view={view} onLog={() => setLogOpen(true)} />}</Async>
      <SessionFormModal open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function Content({ view, onLog }: { view: AchievementsView; onLog: () => void }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('all');
  const [celebrate, setCelebrate] = useState<{ level: number; title: string } | null>(null);
  const { level, streak, daily, weekly_challenges: challenges, achievements } = view;

  // Level-up banner: first visit on a device only records the level; later visits celebrate an increase once.
  useEffect(() => {
    const last = readLastLevel();
    if (last !== null && level.level > last) setCelebrate({ level: level.level, title: level.title });
    storeLevel(level.level);
  }, [level.level, level.title]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const shown = achievements.filter((a) => (filter === 'all' ? true : filter === 'unlocked' ? a.unlocked : !a.unlocked));
  const dailyPct = daily.goal > 0 ? Math.min(100, (daily.minutes / daily.goal) * 100) : 0;
  const levelPct = Math.max(0, Math.min(100, level.progress * 100));

  return (
    <div className="space-y-4">
      {celebrate && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="flex items-center gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3" role="status"
        >
          <Trophy className="h-5 w-5 shrink-0 text-brand-orange" aria-hidden />
          <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">You reached Level {celebrate.level}: {celebrate.title}.</span> <span className="text-ink-soft">Nice work, keep going at your own pace.</span></p>
          <button type="button" onClick={() => setCelebrate(null)} aria-label="Dismiss level-up message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-white/[0.08] hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand-purple/20 to-transparent">
          <CardTitle title="Level" subtitle={level.title} icon={<Trophy className="h-4 w-4" aria-hidden />} />
          <div className="flex items-end gap-3">
            <p className="h-display text-5xl leading-none"><AnimatedNumber value={level.level} /></p>
            <p className="pb-1 text-sm text-ink-soft"><span className="font-semibold text-ink"><AnimatedNumber value={level.xp} /></span> XP total</p>
          </div>
          <ProgressBar value={levelPct} color="#8b5cf6" height="h-2.5" className="mt-4" label={`Progress to level ${level.level + 1}`} />
          <p className="mt-2 text-xs text-ink-soft">
            {level.xp_into_level} / {level.xp_for_next} XP to Level {level.level + 1}
          </p>
        </Card>

        <Card>
          <CardTitle title="Learning streak" subtitle="Consecutive days with study time or a completed topic" icon={<Flame className="h-4 w-4" aria-hidden />} />
          <div className="flex items-end gap-6">
            <div>
              <p className="h-display text-5xl leading-none"><AnimatedNumber value={streak.current} /></p>
              <p className="mt-1 text-sm text-ink-soft">{streak.current === 1 ? 'day' : 'days'} current</p>
            </div>
            <div className="pb-0.5">
              <p className="h-display text-2xl leading-none text-ink-soft"><AnimatedNumber value={streak.longest} /></p>
              <p className="mt-1 text-xs text-ink-mute">{streak.longest === 1 ? 'day' : 'days'} longest</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            {streak.current > 0 ? 'Log time today to keep it going.' : 'Log a study session to start a streak.'}
          </p>
        </Card>

        <Card>
          <CardTitle title="Daily goal" subtitle={`${fmtMinutes(daily.goal)} a day. Change it in Settings.`} icon={<Timer className="h-4 w-4" aria-hidden />} />
          <div className="flex items-center gap-4">
            <ProgressRing value={dailyPct} size={92} stroke={9} color={daily.done ? '#14b8a6' : '#22d3ee'} label={`${Math.round(dailyPct)} percent of today's goal`}>
              <span className="text-sm font-semibold tabular-nums">{Math.round(dailyPct)}%</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-sm"><span className="h-display text-xl tabular-nums">{fmtMinutes(daily.minutes)}</span> <span className="text-ink-soft">of {fmtMinutes(daily.goal)}</span></p>
              {daily.done
                ? <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand-teal"><CheckCircle2 className="h-4 w-4" aria-hidden />Goal reached today</p>
                : <p className="mt-1 text-xs text-ink-soft">{fmtMinutes(Math.max(0, daily.goal - daily.minutes))} to go</p>}
              <button type="button" className="btn-secondary mt-3 min-h-[44px]" onClick={onLog}>Log study time</button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle title="Weekly challenges" subtitle="Goals built from this week's real activity. They reset every Monday." />
        {challenges.length === 0 ? (
          <p className="text-sm text-ink-soft">No challenges this week.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {challenges.map((c) => <ChallengeRow key={c.id} challenge={c} />)}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle
          title="Badges"
          subtitle={`${unlockedCount} of ${achievements.length} unlocked`}
          action={
            <Segmented<Filter>
              ariaLabel="Filter badges" value={filter} onChange={setFilter}
              options={[{ value: 'all', label: 'All' }, { value: 'unlocked', label: 'Unlocked' }, { value: 'locked', label: 'Locked' }]}
            />
          }
        />
        {achievements.length === 0 ? (
          <EmptyState title="No badges available yet" body="Badges appear here once the catalog has been set up on the server." />
        ) : shown.length === 0 ? (
          <EmptyState
            title={filter === 'unlocked' ? 'Nothing unlocked yet' : 'Everything is unlocked'}
            body={filter === 'unlocked' ? 'Complete a topic or log a study session to earn your first badge.' : 'You have earned every badge. Impressive.'}
            action={filter === 'unlocked' ? <button type="button" className="btn-secondary" onClick={() => setFilter('all')}>See all badges</button> : undefined}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((a) => (
              <li
                key={a.id}
                className={`flex gap-3 rounded-2xl border p-4 ${a.unlocked ? 'border-brand-orange/25 bg-brand-orange/[0.06]' : 'border-dashed border-white/10 bg-navy-900/40'}`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${a.unlocked ? 'bg-brand-orange/20 text-brand-orange' : 'bg-white/[0.05] text-ink-mute'}`}>
                  <NamedIcon name={a.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2">
                    <h3 className={`text-sm font-semibold ${a.unlocked ? 'text-ink' : 'text-ink-soft'}`}>{a.name}</h3>
                    <span className="text-xs font-semibold tabular-nums text-ink-soft">+{a.xp} XP</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{a.description}</p>
                  <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${a.unlocked ? 'text-brand-teal' : 'text-ink-mute'}`}>
                    {a.unlocked
                      ? <><Check className="h-3.5 w-3.5" aria-hidden />Unlocked{a.unlocked_at ? ` ${fmtStamp(a.unlocked_at)}` : ''}</>
                      : <><Lock className="h-3.5 w-3.5" aria-hidden />Locked</>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ChallengeRow({ challenge: c }: { challenge: Challenge }) {
  // The "Focus week" challenge counts minutes; the others count days, objectives or topics.
  const isTime = c.id === 'study_5h';
  const fmt = (n: number) => (isTime ? fmtMinutes(n) : String(n));
  const pct = c.target > 0 ? Math.min(100, (c.progress / c.target) * 100) : 0;
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{c.name}</p>
          <p className="text-xs text-ink-soft">{c.description}</p>
        </div>
        {c.done
          ? <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-teal"><CheckCircle2 className="h-4 w-4" aria-hidden />Done</span>
          : <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{fmt(c.progress)} / {fmt(c.target)}</span>}
      </div>
      <ProgressBar value={pct} color={c.done ? '#14b8a6' : '#22d3ee'} height="h-2" className="mt-2" label={`${c.name}: ${fmt(c.progress)} of ${fmt(c.target)}`} />
    </li>
  );
}
