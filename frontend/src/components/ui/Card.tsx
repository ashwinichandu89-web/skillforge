import type { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children?: ReactNode;
  /** Glass panel (translucent + blur). Use sparingly: hero areas only. */
  glass?: boolean;
  [k: string]: any;
}

export function Card({ className = '', children, glass = false, ...rest }: CardProps) {
  return <div className={`${glass ? 'card-glass' : 'card'} p-4 sm:p-5 ${className}`} {...rest}>{children}</div>;
}

interface CardTitleProps { title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode; className?: string }

/** Heading row for a card: optional icon chip, title, subtitle, and a right-aligned action. */
export function CardTitle({ title, subtitle, icon, action, className = 'mb-4' }: CardTitleProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft">{icon}</span>}
        <div className="min-w-0">
          <h2 className="h-display truncate text-base">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-mute">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
