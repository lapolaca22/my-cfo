import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Overview from './pages/Overview'
import AccountsPayable from './pages/AccountsPayable'
import AccountsReceivable from './pages/AccountsReceivable'
import AccountingClose from './pages/AccountingClose'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

// ── Full-page loading spinner ──────────────────────────────────────────────────
function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  )
}

// ── Route guard: redirect to /login if not authenticated ──────────────────────
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user)   return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}

// ── Route guard: redirect to / if already authenticated ───────────────────────
function RedirectIfAuthed() {
  const { user, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (user)    return <Navigate to="/" replace />

  return <Outlet />
}

// ── Shared app shell (sidebar + content area) ─────────────────────────────────
function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public route — redirect to / if already signed in */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected routes — redirect to /login if not signed in */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/"          element={<Overview />} />
            <Route path="/ap"        element={<AccountsPayable />} />
            <Route path="/ar"        element={<AccountsReceivable />} />
            <Route path="/accounting" element={<AccountingClose />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/settings"  element={<Settings />} />
            {/* Catch-all inside app — redirect to dashboard */}
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
