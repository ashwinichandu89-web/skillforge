import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props { open: boolean; onClose: () => void; currentMinutes: number }

const PRESETS = [30, 60, 90, 120, 180];

/** Sets the daily study target (minutes). It drives the daily goal ring, streak-day rules and the planner bars. */
export function DailyTargetModal({ open, onClose, currentMinutes }: Props) {
  const { setUser } = useAuth();
  const { busy, run } = useAction();
  const [minutes, setMinutes] = useState(String(currentMinutes));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMinutes(String(currentMinutes));
    setFormError(null);
  }, [open, currentMinutes]);

  const submit = async () => {
    const m = Math.round(Number(minutes));
    if (!Number.isFinite(m) || m < 5 || m > 960) return setFormError('Choose a target between 5 and 960 minutes.');
    setFormError(null);
    await run(() => api.auth.update({ daily_goal_minutes: m }), {
      success: 'Daily target updated',
      invalidate: ['planner', 'overview', 'achievements'],
      onDone: (u) => { setUser(u); onClose(); },
    });
  };

  return (
    <Modal
      open={open} onClose={busy ? () => undefined : onClose} size="sm" title="Daily study target"
      description="How many minutes you aim to study each day."
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="target-form" className="btn-primary" disabled={busy || Number(minutes) === currentMinutes}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Save target
          </button>
        </>
      }
    >
      <form id="target-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError}</p>}
        <Field label="Minutes per day" htmlFor="dt-minutes" hint="Between 5 minutes and 16 hours.">
          <input id="dt-minutes" className="input" type="number" min={5} max={960} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-autofocus />
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common targets">
          {PRESETS.map((q) => (
            <button
              key={q} type="button" onClick={() => setMinutes(String(q))}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${Number(minutes) === q ? 'bg-brand-purple text-white' : 'bg-white/[0.06] text-ink-soft hover:bg-white/[0.1]'}`}
            >
              {q >= 60 ? `${q / 60}h` : `${q}m`}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}
