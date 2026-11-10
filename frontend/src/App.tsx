import { Loader2 } from 'lucide-react';
import { Suspense, lazy, type ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PageSkeleton } from './components/ui/Skeleton';
import { useAuth } from './context/AuthContext';

// Each page is its own chunk; the shell and auth screens load first.
const Login = lazy(() => import('./pages/Login'));
const Overview = lazy(() => import('./pages/Overview'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const TopicsIndex = lazy(() => import('./pages/TopicsIndex'));
const TopicWorkspace = lazy(() => import('./pages/TopicWorkspace'));
const Planner = lazy(() => import('./pages/Planner'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Resources = lazy(() => import('./pages/Resources'));
const Settings = lazy(() => import('./pages/Settings'));

function FullScreenLoader() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-label="Loading">
      <Loader2 className="h-7 w-7 animate-spin text-brand-purple" />
    </div>
  );
}

/** Protected routes: wait for the session check, then send signed-out visitors to /login (and back afterwards). */
function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function PublicOnly({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="h-display text-5xl text-brand-purple">404</p>
        <p className="mt-2 text-ink-soft">That page doesn't exist.</p>
        <Link to="/" className="btn-primary mt-5">Back to Overview</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login mode="login" /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Login mode="register" /></PublicOnly>} />

          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="roadmap" element={<Roadmap />} />
            <Route path="topics" element={<TopicsIndex />} />
            <Route path="topics/:topicId" element={<TopicWorkspace />} />
            <Route path="planner" element={<Planner />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="resources" element={<Resources />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
