import { Bell, RefreshCw, Download, ChevronDown } from 'lucide-react'
import { alerts } from '../data/mockData'
import clsx from 'clsx'

const urgentAlerts = alerts.filter(a => a.level === 'error' || a.level === 'warning')

export default function TopBar({ title, subtitle }) {
  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 sticky top-0 z-10">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-bold text-slate-800 leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Period selector */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
          Feb 2026
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Refresh */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        {/* Export */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-sm">
          <Download className="w-3.5 h-3.5" />
          Export
        </button>

        {/* Notifications */}
        <div className="relative ml-1">
          <button className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
            <Bell className="w-4 h-4 text-slate-500" />
          </button>
          {urgentAlerts.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white">
              {urgentAlerts.length}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
