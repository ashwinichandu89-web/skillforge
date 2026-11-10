import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { cache, subscribeInvalidation } from '../api/cache';

interface QueryState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  loading: boolean;       // first load with nothing to show
  refreshing: boolean;    // background refetch
  fromCache: boolean;     // showing saved data because the server could not be reached
  refetch: () => void;
}

/**
 * Stale-while-revalidate query. `key` doubles as the cache key and the invalidation prefix:
 * invalidate('topic') refetches every query whose key starts with 'topic'.
 * Pass key = null to skip fetching (e.g. a dependent query).
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | undefined>(() => (key ? cache.get<T>(key) : undefined));
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState<boolean>(() => (key ? cache.get<T>(key) === undefined : false));
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const run = useCallback(async () => {
    if (!key) return;
    const id = ++seq.current;
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id !== seq.current) return; // a newer request superseded this one
      setData(result);
      setError(null);
      setFromCache(false);
      cache.set(key, result);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e as Error);
      setFromCache(cache.get<T>(key) !== undefined);
    } finally {
      if (id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [key]);

  // Key changed: show cached value for the new key immediately (or nothing), then fetch.
  useEffect(() => {
    if (!key) { setData(undefined); setLoading(false); return; }
    const cached = cache.get<T>(key);
    setData(cached);
    setLoading(cached === undefined);
    setError(null);
    void run();
  }, [key, run]);

  useEffect(() => {
    if (!key) return;
    return subscribeInvalidation((prefix) => { if (key.startsWith(prefix)) void run(); });
  }, [key, run]);

  return { data, error, loading, refreshing, fromCache, refetch: () => void run() };
}
