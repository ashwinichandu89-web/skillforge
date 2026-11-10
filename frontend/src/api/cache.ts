/**
 * Read cache (stale-while-revalidate). The server is always the source of truth:
 * cached data only gives an instant first paint and a fallback when the API is unreachable.
 * Writes never go through here. Entries are namespaced per user and wiped on logout.
 */
const PREFIX = 'sf:cache:';
let namespace = 'anon';

export const cache = {
  setUser(id: number | null) { namespace = id === null ? 'anon' : String(id); },
  get<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(`${PREFIX}${namespace}:${key}`);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch { return undefined; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(`${PREFIX}${namespace}:${key}`, JSON.stringify(value)); } catch { /* quota or private mode */ }
  },
  clearAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },
};

// Lightweight invalidation bus: mutations call invalidate('topics') and every matching query refetches.
type Listener = (prefix: string) => void;
const listeners = new Set<Listener>();
export const subscribeInvalidation = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const invalidate = (...prefixes: string[]) => prefixes.forEach((p) => listeners.forEach((l) => l(p)));
export const invalidateAll = () => invalidate('');
