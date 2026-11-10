/**
 * Shared chart styling. Colours here were run through the data-viz palette validator
 * against the card surface (#10172e): lightness band, chroma, colour-vision-deficiency
 * separation, normal-vision separation and contrast all pass for the adjacent-pair order below.
 *
 * Rules every chart in the app follows:
 *  - categorical colours are assigned in this fixed order and follow the ENTITY (a category keeps
 *    its colour whatever is filtered), never the rank
 *  - one value axis per chart (never dual axis): two measures of different scale = two charts or a toggle
 *  - text uses the ink tokens, never the series colour
 *  - recessive grid, thin marks, rounded data-ends, a visible tooltip on hover
 *  - 2+ series always get a legend; the chart's title names a single series
 */
export const SERIES = ['#9085e9', '#199e70', '#d95926', '#3987e5', '#d55181', '#c98500'] as const;

/** Sequential ramp for heatmap intensity (one hue, light = more). Zero activity is HEAT_EMPTY. */
export const HEAT = ['#4b4ba9', '#655fcb', '#8a82ee', '#b9b2fb'] as const;
export const HEAT_EMPTY = '#1a2347';

export const INK = { primary: '#e6e9f5', secondary: '#a7b0cf', muted: '#8d97bd' } as const;
export const GRID = 'rgba(255,255,255,0.07)';
export const SURFACE = '#10172e';

/** Spread onto <XAxis>/<YAxis>. */
export const axisProps = {
  tick: { fill: INK.muted, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;

/** Spread onto <CartesianGrid>. Horizontal lines only: quiet scaffolding. */
export const gridProps = { stroke: GRID, vertical: false } as const;

/** Spread onto <Tooltip> alongside content={<ChartTooltip .../>}. */
export const tooltipProps = {
  cursor: { fill: 'rgba(255,255,255,0.05)' },
  wrapperStyle: { outline: 'none', zIndex: 20 },
} as const;

interface TooltipRow { name?: string; value?: number | string; color?: string; dataKey?: string; payload?: any }
interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  labelFormatter?: (label: any, payload: TooltipRow[]) => string;
  valueFormatter?: (value: number, name: string) => string;
}

/** Pass as <Tooltip content={<ChartTooltip valueFormatter={...} />} />. Recharts injects active/payload/label. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[8rem] rounded-xl border border-white/10 bg-navy-700/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && label !== '' && (
        <p className="mb-1 font-semibold text-ink">{labelFormatter ? labelFormatter(label, payload) : String(label)}</p>
      )}
      {payload.map((row, i) => (
        <p key={`${row.dataKey ?? row.name ?? i}`} className="flex items-center justify-between gap-4 text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: row.color }} aria-hidden />
            {row.name}
          </span>
          <span className="font-semibold tabular-nums text-ink">
            {valueFormatter && typeof row.value === 'number' ? valueFormatter(row.value, row.name ?? '') : row.value}
          </span>
        </p>
      ))}
    </div>
  );
}
