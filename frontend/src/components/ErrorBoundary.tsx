import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/** Last line of defence: a render crash shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaces in the browser console; wire to a client-side error reporter here if you add one.
    console.error('UI crash', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-full place-items-center p-6">
        <div className="card flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-500/15 text-red-300"><AlertTriangle className="h-6 w-6" /></div>
          <h1 className="h-display text-lg">Something went wrong</h1>
          <p className="text-sm text-ink-soft">The page hit an unexpected error. Your saved progress is safe on the server. Reload to continue.</p>
          <button type="button" className="btn-primary mt-1" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
