interface ProgressBarProps {
  /** 0-100 */
  value: number;
  color?: string;
  /** Tailwind height class, e.g. "h-1.5". */
  height?: string;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, color = '#9085e9', height = 'h-2', className = '', label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full bg-white/[0.08] ${className}`}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
