/**
 * Single HTTP wrapper for the SkillForge API.
 *  - attaches the access token
 *  - on 401 refreshes once (single-flight) and retries the request
 *  - normalises every failure into ApiError with a human-readable message
 *
 * Token storage note: tokens live in localStorage so sessions survive reloads. That is
 * readable by any script on this origin, so never add third-party scripts to this app.
 */
const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const BASE: string = rawBase && rawBase.length > 0 ? rawBase : '/api';
const TOKEN_KEY = 'sf:tokens';

interface Tokens { access: string; refresh: string }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  get isNetwork() { return this.status === 0; }
}

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch { return null; }
}

export function setTokens(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: session lasts until reload */ memoryTokens = t; }
}
let memoryTokens: Tokens | null = null;
export const hasTokens = () => !!(readTokens() ?? memoryTokens);
const getTokens = () => readTokens() ?? memoryTokens;

export const LOGOUT_EVENT = 'sf:logout';
let refreshing: Promise<boolean> | null = null;

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
}

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const t = getTokens();
  if (!t) return false;
  refreshing = (async () => {
    try {
      const res = await rawFetch('/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens({ access: data.access_token, refresh: data.refresh_token });
      return true;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') detail = body.detail;
  } catch { /* non-JSON error body */ }
  if (res.status === 429) detail = 'Too many requests. Please wait a moment and try again.';
  if (res.status >= 500 && res.status !== 503) detail = 'Something went wrong on our side. Please try again.';
  return new ApiError(res.status, detail);
}

export async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = getTokens();
  if (t) headers.Authorization = `Bearer ${t.access}`;

  const res = await rawFetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return request<T>(method, path, body, true);
    setTokens(null);
    window.dispatchEvent(new Event(LOGOUT_EVENT));
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
  del: <T = void>(p: string) => request<T>('DELETE', p),
};

export function qs(params: Record<string, string | number | null | undefined>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : '';
}
