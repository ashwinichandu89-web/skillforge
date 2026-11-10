/** Placeholder block shown while the first load is in flight. Size it with Tailwind classes. */
export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.05] ${className}`} aria-hidden />;
}

/** Generic page-shaped placeholder: a header line and a grid of cards. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" /><Skeleton className="h-64" />
      </div>
    </div>
  );
}
