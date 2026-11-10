import type { ReactNode } from 'react';

interface FieldProps { label: string; htmlFor?: string; hint?: string; error?: string | null; className?: string; children: ReactNode }

/** Label + control + hint/error. The control itself uses the `input` class (inputs, selects, textareas). */
export function Field({ label, htmlFor, hint, error, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-300" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}
