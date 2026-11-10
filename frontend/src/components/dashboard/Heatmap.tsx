import { useMemo } from 'react';
import { HEAT, HEAT_EMPTY } from '../../lib/chartTheme';
import { fmtDate, fmtMinutes, parseISO } from '../../lib/format';

interface Day { date: string; minutes: number; completions: number }

const CELL = 12; // px
const GAP = 3;   // px
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** Level 0-3 from the user's own distribution of non-zero days (quartile-ish), so the ramp always uses its full range. */
function thresholds(days: Day[]): [number, number, number] {
  const m = days.filter((d) => d.minutes > 0).map((d) => d.minutes).sort((a, b) => a - b);
  if (m.length === 0) return [0, 0, 0];
  const at = (p: number) => m[Math.min(m.length - 1, Math.floor(p * m.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

function levelOf(d: Day, [q1, q2, q3]: [number, number, number]): number {
  if (d.minutes <= 0) return d.completions > 0 ? 0 : -1; // -1 = no activity
  if (d.minutes <= q1) return 0;
  if (d.minutes <= q2) return 1;
  if (d.minutes <= q3) return 2;
  return 3;
}

function describe(d: Day): string {
  const when = fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const studied = d.minutes > 0 ? fmtMinutes(d.minutes) : 'no study time';
  const done = d.completions > 0 ? `, ${d.completions} ${d.completions === 1 ? 'topic' : 'topics'} completed` : '';
  return `${when}: ${studied}${done}`;
}

/** GitHub-style yearly activity grid. Columns are weeks starting Monday; scrolls sideways on phones. */
export function Heatmap({ days }: { days: Day[] }) {
  const { columns, monthLabels, cut } = useMemo(() => {
    const cols: (Day | null)[][] = [];
    let current: (Day | null)[] = [];
    days.forEach((d, i) => {
      const dow = (parseISO(d.date).getDay() + 6) % 7; // Monday = 0
      if (i === 0) for (let k = 0; k < dow; k++) current.push(null);
      current.push(d);
      if (current.length === 7) { cols.push(current); current = []; }
    });
    if (current.length) { while (current.length < 7) current.push(null); cols.push(current); }

    const labels: string[] = [];
    let lastLabelCol = -10;
    let lastMonth = -1;
    cols.forEach((col, i) => {
      const first = col.find((c): c is Day => c !== null);
      const month = first ? parseISO(first.date).getMonth() : lastMonth;
      if (first && month !== lastMonth && i - lastLabelCol >= 3) {
        labels[i] = parseISO(first.date).toLocaleDateString(undefined, { month: 'short' });
        lastLabelCol = i;
      }
      lastMonth = month;
    });
    return { columns: cols, monthLabels: labels, cut: thresholds(days) };
  }, [days]);

  const template = `repeat(${columns.length}, ${CELL}px)`;
  const activeDays = days.filter((d) => d.minutes > 0 || d.completions > 0).length;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-max">
          <div className="grid" style={{ gridTemplateColumns: template, columnGap: GAP, marginLeft: 28 }} aria-hidden>
            {columns.map((_, i) => (
              <div key={i} className="relative h-4 text-[10px] text-ink-mute">
                {monthLabels[i] && <span className="absolute left-0 whitespace-nowrap">{monthLabels[i]}</span>}
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: 6 }}>
            <div className="grid w-[22px] shrink-0 text-[10px] text-ink-mute" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }} aria-hidden>
              {WEEKDAYS.map((w, i) => <span key={i} className="leading-[12px]">{w}</span>)}
            </div>
            <div
              role="group" aria-label={`Daily study activity over the last year. ${activeDays} active days.`}
              className="grid grid-flow-col"
              style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridTemplateColumns: template, gap: GAP }}
            >
              {columns.flatMap((col, ci) => col.map((d, ri) => {
                if (!d) return <span key={`${ci}-${ri}`} aria-hidden />;
                const level = levelOf(d, cut);
                return (
                  <span
                    key={d.date} role="img" aria-label={describe(d)} title={describe(d)}
                    className="rounded-[3px] outline-offset-1 transition hover:outline hover:outline-1 hover:outline-white/60"
                    style={{ background: level < 0 ? HEAT_EMPTY : HEAT[level] }}
                  />
                );
              }))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-mute" aria-hidden>
        Less
        {[HEAT_EMPTY, ...HEAT].map((c) => <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />)}
        More
      </div>
    </div>
  );
}
