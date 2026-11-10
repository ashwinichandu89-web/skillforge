import { motion } from 'framer-motion';
import {
  BarChart3, BookOpenCheck, CalendarDays, ChevronsLeft, ChevronsRight, LayoutDashboard, Library, LogOut,
  Map as MapIcon, MoreHorizontal, Settings as SettingsIcon, Trophy, WifiOff, type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnline } from '../../hooks/useOnline';
import { Modal } from '../ui/Modal';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

/** The eight sections from the product brief, in order. */
const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/roadmap', label: 'Learning Roadmap', icon: MapIcon },
  { to: '/topics', label: 'Topic Workspace', icon: BookOpenCheck },
  { to: '/planner', label: 'Study Planner', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/resources', label: 'Resource Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];
/** Phones get four primary tabs plus a "More" sheet for the rest. */
const PRIMARY = ['/', '/roadmap', '/planner', '/analytics'];

const SIDEBAR_KEY = 'sf:sidebar';

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-cyan shadow-lg shadow-brand-purple/20" aria-hidden>
        <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 23l7-15 7 15h-5l-2-4.5-2 4.5z" fill="white" /></svg>
      </span>
      {!compact && <span className="h-display text-lg">SkillForge</span>}
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [moreOpen, setMoreOpen] = useState(false);

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1'); } catch { /* preference only */ }
    return !c;
  });

  useEffect(() => { window.scrollTo(0, 0); setMoreOpen(false); }, [pathname]);

  const linkClass = (active: boolean, compact: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60 ${
      compact ? 'justify-center' : ''} ${active ? 'bg-brand-purple/15 text-white' : 'text-ink-soft hover:bg-white/[0.05] hover:text-ink'}`;

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();
  const secondary = NAV.filter((n) => !PRIMARY.includes(n.to));

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-brand-purple focus:px-3 focus:py-2 focus:text-sm focus:font-semibold">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.06] bg-navy-950/60 py-5 transition-[width] duration-200 lg:flex ${collapsed ? 'w-[4.75rem] px-3' : 'w-64 px-4'}`}
        aria-label="Primary"
      >
        <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
          <Logo compact={collapsed} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} aria-label={label} className={({ isActive }) => linkClass(isActive, collapsed)}>
              <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-1'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-brand-purple text-sm font-bold" aria-hidden>{initial}</span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-ink-mute">{user?.email}</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => void logout()} className={`${linkClass(false, collapsed)} w-full`} title={collapsed ? 'Sign out' : undefined} aria-label="Sign out">
            <LogOut className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden />{!collapsed && 'Sign out'}
          </button>
          <button
            type="button" onClick={toggle} aria-pressed={collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`${linkClass(false, collapsed)} w-full`}
          >
            {collapsed ? <ChevronsRight className="h-[1.15rem] w-[1.15rem]" aria-hidden /> : <><ChevronsLeft className="h-[1.15rem] w-[1.15rem]" aria-hidden />Collapse</>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-navy-900/85 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-orange to-brand-purple text-xs font-bold" aria-hidden>{initial}</span>
        </header>

        {!online && (
          <div className="flex items-center justify-center gap-2 bg-brand-orange/15 px-4 py-2 text-center text-sm text-brand-orange" role="status">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            You're offline. Saved data is shown, and changes can't be saved until you reconnect.
          </div>
        )}

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.08] bg-navy-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
        {NAV.filter((n) => PRIMARY.includes(n.to)).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 px-1 py-2 text-[0.65rem] font-semibold ${isActive ? 'text-brand-cyan' : 'text-ink-mute'}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate">{label.replace('Learning ', '').replace('Study ', '')}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 px-1 py-2 text-[0.65rem] font-semibold text-ink-mute">
          <MoreHorizontal className="h-5 w-5" aria-hidden />More
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <ul className="space-y-1">
          {secondary.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => linkClass(isActive, false)}>
                <Icon className="h-5 w-5" aria-hidden />{label}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" className={`${linkClass(false, false)} w-full`} onClick={() => { setMoreOpen(false); void logout(); }}>
              <LogOut className="h-5 w-5" aria-hidden />Sign out
            </button>
          </li>
        </ul>
      </Modal>
    </div>
  );
}
