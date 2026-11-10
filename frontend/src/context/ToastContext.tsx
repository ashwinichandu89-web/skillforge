import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Trophy, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UnlockedAchievement } from '../types';

type Kind = 'success' | 'error' | 'achievement';
interface ToastItem { id: number; kind: Kind; title: string; body?: string }

interface ToastApi {
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  achievements: (items: UnlockedAchievement[] | undefined) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : kind === 'achievement' ? 6000 : 3500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (t, b) => push('success', t, b),
    error: (t, b) => push('error', t, b),
    achievements: (list) => (list ?? []).forEach((a) => push('achievement', `Achievement unlocked: ${a.name}`, `${a.description} +${a.xp} XP`)),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2 lg:bottom-6" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id} layout initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24 }}
              className={`pointer-events-auto flex gap-3 rounded-xl border p-3 shadow-xl backdrop-blur ${
                t.kind === 'error' ? 'border-red-400/30 bg-red-950/80' : t.kind === 'achievement' ? 'border-brand-orange/40 bg-navy-700/95' : 'border-brand-teal/30 bg-navy-700/95'}`}
            >
              {t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                : t.kind === 'achievement' ? <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-ink-soft">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-mute hover:text-ink"><X className="h-4 w-4" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}
