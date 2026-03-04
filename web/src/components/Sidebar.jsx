import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
  Bell,
} from 'lucide-react'
import { pendingApprovals, alerts } from '../data/mockData'
import clsx from 'clsx'

const navItems = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Agents',
    items: [
      { label: 'Accounts Payable', to: '/ap', icon: FileText,   badge: pendingApprovals.length },
      { label: 'Accounts Receivable', to: '/ar', icon: Receipt },
      { label: 'Accounting & Close', to: '/accounting', icon: BookOpen },
      { label: 'Reports', to: '/reports', icon: BarChart3 },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const location = useLocation()
  const alertCount = alerts.filter(a => a.level === 'error' || a.level === 'warning').length

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-brand-950 text-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-brand-900">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-500 shadow-lg">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight tracking-tight">my-cfo</p>
          <p className="text-xs text-brand-400 font-normal">Finance Automation</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6">
        {navItems.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-500">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, to, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-brand-700 text-white shadow-md'
                          : 'text-brand-300 hover:bg-brand-900 hover:text-white'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-500 text-[10px] font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Alerts panel */}
      {alertCount > 0 && (
        <div className="mx-3 mb-3 rounded-2xl bg-brand-900 border border-brand-800 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-amber-400">
              {alertCount} Active Alert{alertCount !== 1 ? 's' : ''}
            </p>
          </div>
          <ul className="space-y-1">
            {alerts
              .filter(a => a.level !== 'info')
              .map(alert => (
                <li key={alert.id} className="flex items-start gap-1.5">
                  <span
                    className={clsx(
                      'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                      alert.level === 'error' ? 'bg-red-400' : 'bg-amber-400'
                    )}
                  />
                  <p className="text-[11px] text-brand-300 leading-snug">{alert.message}</p>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* User footer */}
      <div className="flex items-center gap-3 px-4 py-4 border-t border-brand-900">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-xs font-bold text-white shrink-0">
          CF
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">CFO User</p>
          <p className="text-[11px] text-brand-400 truncate">cfo@startup.com</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-brand-500 shrink-0" />
      </div>
    </aside>
  )
}
