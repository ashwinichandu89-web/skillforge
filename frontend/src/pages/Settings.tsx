import { Eye, EyeOff, ExternalLink, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api/endpoints';
import { cache, invalidateAll } from '../api/cache';
import { Card, CardTitle } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useToast } from '../context/ToastContext';

const FALLBACK_TZ = ['UTC', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];

function timezones(current: string): string[] {
  let list: string[] = FALLBACK_TZ;
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) list = fn('timeZone');
  } catch { /* use fallback */ }
  return list.includes(current) ? list : [current, ...list];
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, security and how your data syncs." />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
        <DataCard />
        <SessionCard />
      </div>
    </>
  );
}

function ProfileCard() {
  const { user, setUser } = useAuth();
  const { busy, run, error } = useAction();
  const [name, setName] = useState(user?.name ?? '');
  const [tz, setTz] = useState(user?.timezone ?? 'UTC');
  const [goal, setGoal] = useState(String(user?.daily_goal_minutes ?? 60));
  const [formError, setFormError] = useState<string | null>(null);
  const zones = useMemo(() => timezones(user?.timezone ?? 'UTC'), [user?.timezone]);

  if (!user) return null;
  const dirty = name.trim() !== user.name || tz !== user.timezone || Number(goal) !== user.daily_goal_minutes;

  const save = async () => {
    const g = Math.round(Number(goal));
    if (!name.trim()) return setFormError('Name is required.');
    if (!Number.isFinite(g) || g < 5 || g > 960) return setFormError('Daily goal must be between 5 and 960 minutes.');
    setFormError(null);
    await run(() => api.auth.update({ name: name.trim(), timezone: tz, daily_goal_minutes: g }), {
      success: 'Profile saved', invalidate: ['planner', 'overview', 'achievements'], onDone: (u) => setUser(u),
    });
  };

  return (
    <Card>
      <CardTitle title="Profile" subtitle="Used for greetings, streak days and your daily goal" />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        {(formError ?? error) && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{formError ?? error}</p>}
        <Field label="Name" htmlFor="st-name"><input id="st-name" className="input min-h-[44px]" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" htmlFor="st-email" hint="Your email is your sign-in and can't be changed here."><input id="st-email" className="input min-h-[44px]" value={user.email} readOnly disabled /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone" htmlFor="st-tz" hint="Decides which calendar day a session counts toward.">
            <select id="st-tz" className="input min-h-[44px]" value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select>
          </Field>
          <Field label="Daily goal (minutes)" htmlFor="st-goal">
            <input id="st-goal" className="input min-h-[44px]" type="number" min={5} max={960} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="btn-primary min-h-[44px]" disabled={busy || !dirty}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save profile</button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { busy, run } = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!current) return setError('Enter your current password.');
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return setError('The new password needs at least 8 characters, a letter and a number.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setError(null);
    const res = await run(async () => { await api.auth.changePassword({ current_password: current, new_password: next }); return true; }, { success: 'Password changed' });
    if (res) { setCurrent(''); setNext(''); setConfirm(''); }
  };

  return (
    <Card>
      <CardTitle title="Password" subtitle="Choose a password you don't use anywhere else" />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}
        <Field label="Current password" htmlFor="pw-current"><input id="pw-current" className="input min-h-[44px]" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" htmlFor="pw-new" hint="At least 8 characters with a letter and a number."><input id="pw-new" className="input min-h-[44px]" type={show ? 'text' : 'password'} autoComplete="new-password" value={next} maxLength={128} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Confirm new password" htmlFor="pw-confirm"><input id="pw-confirm" className="input min-h-[44px]" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} maxLength={128} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary min-h-[44px]" disabled={busy || !current || !next || !confirm}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Change password</button>
          <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{show ? 'Hide' : 'Show'}</button>
        </div>
      </form>
    </Card>
  );
}

function DataCard() {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Card>
      <CardTitle title="Data and sync" subtitle="Where your progress lives" />
      <p className="text-sm text-ink-soft">Your progress, notes, resources and study history are stored in the cloud database and tied to your account, so every device you sign in on shows the same data. This device also keeps a temporary copy so pages open instantly and still show something when you're offline.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary min-h-[44px]" onClick={() => { invalidateAll(); toast.success('Refreshing from the server'); }}><RefreshCw className="h-4 w-4" />Refresh from server</button>
        <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setConfirmOpen(true)}>Clear saved copy on this device</button>
        <a className="btn-ghost min-h-[44px]" href="/api/docs" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />API documentation</a>
      </div>
      <ConfirmDialog
        open={confirmOpen} title="Clear the saved copy?" confirmLabel="Clear and reload"
        message="This only removes the temporary copy on this device. Nothing on the server is deleted, and pages reload from it."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { cache.clearAll(); invalidateAll(); setConfirmOpen(false); toast.success('Saved copy cleared'); }}
      />
    </Card>
  );
}

function SessionCard() {
  const { logout, user } = useAuth();
  return (
    <Card>
      <CardTitle title="Session" subtitle={user ? `Signed in as ${user.email}` : undefined} />
      <p className="text-sm text-ink-soft">Signing out ends this device's session and removes its saved copy. Your data stays in your account.</p>
      <button type="button" className="btn-danger mt-4 min-h-[44px]" onClick={() => void logout()}><LogOut className="h-4 w-4" />Sign out</button>
    </Card>
  );
}
