import type { ReactNode } from 'react';
import { ErrorState, OfflineNotice } from './EmptyState';
import { PageSkeleton } from './Skeleton';

/** The subset of useQuery()'s return value that Async needs. */
interface QueryLike<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  fromCache: boolean;
  refetch: () => void;
}

interface AsyncProps<T> {
  query: QueryLike<T>;
  /** Shown during the first load when there is nothing cached. Defaults to a page skeleton. */
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Gives every data-backed screen the same three states:
 *  - first load, nothing cached  -> skeleton
 *  - failed, nothing cached      -> error panel with retry
 *  - data available              -> children(data); if the latest fetch failed, a banner says this is saved data
 */
export function Async<T>({ query, skeleton, children }: AsyncProps<T>) {
  if (query.data !== undefined) {
    return (
      <>
        {query.error && query.fromCache && <OfflineNotice onRetry={query.refetch} />}
        {children(query.data)}
      </>
    );
  }
  if (query.loading) return <>{skeleton ?? <PageSkeleton />}</>;
  if (query.error) return <ErrorState message={query.error.message} onRetry={query.refetch} />;
  return null;
}
