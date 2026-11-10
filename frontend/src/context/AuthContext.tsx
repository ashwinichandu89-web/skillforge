import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/endpoints';
import { ApiError, LOGOUT_EVENT, hasTokens, setTokens } from '../api/client';
import { cache, invalidateAll } from '../api/cache';
import type { AuthResponse, User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);
const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(hasTokens());

  const applySession = useCallback((res: AuthResponse) => {
    setTokens({ access: res.access_token, refresh: res.refresh_token });
    cache.setUser(res.user.id);
    setUserState(res.user);
  }, []);

  const clear = useCallback(() => {
    setTokens(null);
    cache.clearAll();
    cache.setUser(null);
    setUserState(null);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!hasTokens()) return;
    let cancelled = false;
    api.auth.me()
      .then((u) => { if (!cancelled) { cache.setUser(u.id); setUserState(u); } })
      .catch((e) => { if (!cancelled && !(e instanceof ApiError && e.isNetwork)) clear(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clear]);

  // The API client fires this when a refresh token is rejected.
  useEffect(() => {
    const onLogout = () => clear();
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, [clear]);

  const value = useMemo<AuthState>(() => ({
    user, loading,
    login: async (email, password) => { applySession(await api.auth.login({ email, password })); invalidateAll(); },
    register: async (name, email, password) => { applySession(await api.auth.register({ name, email, password, timezone: browserTz() })); invalidateAll(); },
    logout: async () => {
      try {
        const raw = localStorage.getItem('sf:tokens');
        const refresh = raw ? (JSON.parse(raw) as { refresh: string }).refresh : null;
        if (refresh) await api.auth.logout(refresh);
      } catch { /* best effort: tokens are cleared locally regardless */ }
      clear();
    },
    setUser: (u) => setUserState(u),
  }), [user, loading, applySession, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
