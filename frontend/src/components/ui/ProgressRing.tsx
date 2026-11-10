import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';

interface ProgressRingProps {
  /** 0-100 */
  value: number;
  size?: number;
  stroke?: number;
  /** Solid colour, or pass `gradient` for a two-stop gradient. */
  color?: string;
  gradient?: [string, string];
  track?: string;
  /** Accessible description; defaults to "N percent". */
  label?: string;
  className?: string;
  /** Rendered in the centre of the ring. */
  children?: ReactNode;
}

export function ProgressRing({
  value, size = 96, stroke = 10, color = '#9085e9', gradient, track = 'rgba(255,255,255,0.08)', label, className = '', children,
}: ProgressRingProps) {
  const gid = useId();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gradient ? `url(#${gid})` : color}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      {children !== undefined && <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>}
    </div>
  );
}
