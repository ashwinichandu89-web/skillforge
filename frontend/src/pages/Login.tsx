import { motion } from 'framer-motion';
import { Cloud, Eye, EyeOff, Flame, ListChecks, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';

// Same rules the API enforces (schemas/auth.py), so people see problems before submitting.
const passwordRules = (pw: string) => [
  { ok: pw.length >= 8, label: 'At least 8 characters' },
  { ok: /[A-Za-z]/.test(pw), label: 'A letter' },
  { ok: /\d/.test(pw), label: 'A number' },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const POINTS = [
  { icon: Cloud, title: 'Synced everywhere', body: 'Progress, notes and resources live in the cloud, so your phone and laptop always agree.' },
  { icon: ListChecks, title: 'A complete roadmap', body: 'Six categories from DSA to client communication, each topic with objectives, exercises and interview questions.' },
  { icon: Flame, title: 'Built for consistency', body: 'A weekly planner, daily goals, streaks and analytics that show where your time really goes.' },
];

export default function Login({ mode }: { mode: Mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const isRegister = mode === 'register';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = passwordRules(password);
  const passwordOk = rules.every((r) => r.ok);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim();
    if (isRegister && !name.trim()) return setError('Enter your name.');
    if (!EMAIL_RE.test(cleanEmail)) return setError('Enter a valid email address.');
    if (isRegister && !passwordOk) return setError('Choose a password with at least 8 characters, a letter and a number.');
    if (!isRegister && !password) return setError('Enter your password.');
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), cleanEmail, password);
      else await login(cleanEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden border-r border-white/[0.06] bg-navy-950/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-purple/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-cyan/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-cyan" aria-hidden>
            <svg viewBox="0 0 32 32" className="h-6 w-6"><path d="M9 23l7-15 7 15h-5l-2-4.5-2 4.5z" fill="white" /></svg>
          </span>
          <span className="h-display text-xl">SkillForge</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="h-display text-4xl leading-tight">Become a Solution Engineer, one topic at a time.</h1>
          <p className="mt-4 text-ink-soft">Track what you've learned, plan what's next, and see exactly how far through the roadmap you are.</p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-brand-cyan"><Icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-mute">Your learning data is private to your account.</p>
      </section>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-cyan" aria-hidden>
              <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 23l7-15 7 15h-5l-2-4.5-2 4.5z" fill="white" /></svg>
            </span>
            <span className="h-display text-lg">SkillForge</span>
          </div>

          <h2 className="h-display text-2xl">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1 text-sm text-ink-soft">{isRegister ? 'Start tracking your Solution Engineer roadmap.' : 'Sign in to pick up where you left off.'}</p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}

            {isRegister && (
              <Field label="Name" htmlFor="auth-name">
                <input id="auth-name" className="input min-h-[44px]" autoComplete="name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}

            <Field label="Email" htmlFor="auth-email">
              <input id="auth-email" className="input min-h-[44px]" type="email" inputMode="email" autoComplete="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field label="Password" htmlFor="auth-password">
              <div className="relative">
                <input
                  id="auth-password" className="input min-h-[44px] pr-11" type={show ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} maxLength={128}
                  onChange={(e) => setPassword(e.target.value)} aria-describedby={isRegister ? 'pw-rules' : undefined}
                />
                <button
                  type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
                  className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {isRegister && (
              <ul id="pw-rules" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {rules.map((r) => (
                  <li key={r.label} className={r.ok ? 'text-brand-teal' : 'text-ink-mute'}>
                    <span aria-hidden>{r.ok ? '✓' : '○'}</span> {r.label}<span className="sr-only">{r.ok ? ' (met)' : ' (not met yet)'}</span>
                  </li>
                ))}
              </ul>
            )}

            <button type="submit" className="btn-primary min-h-[44px] w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {isRegister ? 'Already have an account? ' : 'New to SkillForge? '}
            <Link to={isRegister ? '/login' : '/register'} state={location.state} className="font-semibold text-brand-cyan hover:underline">
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
