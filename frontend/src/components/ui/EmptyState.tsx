import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }

/** Friendly "nothing here yet" panel. Always say what to do next in `body`/`action`. */
export function EmptyState({ icon, title, body, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center ${className}`}>
      {icon && <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-ink-soft">{icon}</div>}
      <p className="h-display text-base">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Shown when a request failed and there is nothing saved to fall back on. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-500/15 text-red-300"><AlertTriangle className="h-6 w-6" /></div>
      <p className="h-display text-lg">We couldn't load this</p>
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && <button type="button" className="btn-secondary mt-1" onClick={onRetry}><RefreshCw className="h-4 w-4" />Try again</button>}
    </div>
  );
}

/** Slim banner shown above content that is being served from the local cache because the server was unreachable. */
export function OfflineNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-2.5 text-sm" role="status">
      <WifiOff className="h-4 w-4 shrink-0 text-brand-orange" />
      <p className="min-w-0 flex-1 text-ink-soft">Can't reach the server, so this is the last saved copy. Changes can't be saved until you're back online.</p>
      {onRetry && <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={onRetry}>Retry</button>}
    </div>
  );
}
