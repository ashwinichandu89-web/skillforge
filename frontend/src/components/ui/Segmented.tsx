interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}

/** Compact single-choice toggle (e.g. "Topics | Hours"). Keyboard accessible radio group. */
export function Segmented<T extends string>({ value, onChange, options, ariaLabel, className = '' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex rounded-xl border border-white/10 bg-navy-900 p-0.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`rounded-[10px] px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 ${
            o.value === value ? 'bg-brand-purple text-white' : 'text-ink-soft hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
