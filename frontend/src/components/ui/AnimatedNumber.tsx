import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface AnimatedNumberProps { value: number; decimals?: number; suffix?: string; className?: string }

/** Counts up from 0 on first render and eases between values afterwards. Honors reduced-motion. */
export function AnimatedNumber({ value, decimals = 0, suffix = '', className = '' }: AnimatedNumberProps) {
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState<number>(reduce ? value : 0);
  const from = useRef<number>(reduce ? value : 0);

  useEffect(() => {
    if (reduce) { from.current = value; setShown(value); return; }
    const startValue = from.current;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = startValue + (value - startValue) * eased;
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  const text = shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={`tabular-nums ${className}`}>{text}{suffix}</span>;
}
