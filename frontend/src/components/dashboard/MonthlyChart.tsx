import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, SERIES, axisProps, gridProps, tooltipProps } from '../../lib/chartTheme';
import { fmtHours, fmtMonth } from '../../lib/format';

interface Props {
  months: { month: string; completed: number; hours: number }[];
  measure: 'completed' | 'hours';
  height?: number;
}

/** One measure at a time (never a dual axis). Shared by Overview and Analytics. */
export function MonthlyChart({ months, measure, height = 208 }: Props) {
  const isTopics = measure === 'completed';
  const color = isTopics ? SERIES[0] : SERIES[1];
  const label = isTopics ? 'Topics completed' : 'Study hours';
  const rows = months.map((m) => ({
    key: m.month, label: fmtMonth(m.month), value: isTopics ? m.completed : Math.round(m.hours * 10) / 10,
  }));
  const summary = rows.map((r) => `${r.label}: ${isTopics ? r.value : fmtHours(r.value)}`).join(', ');
  const gradientId = `monthly-${measure}`;

  return (
    <div role="img" aria-label={`${label} per month. ${summary}.`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} allowDecimals={!isTopics} width={44} />
          <Tooltip
            {...tooltipProps}
            content={<ChartTooltip valueFormatter={(v) => (isTopics ? String(v) : fmtHours(v))} />}
          />
          <Area type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2.25} fill={`url(#${gradientId})`} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
