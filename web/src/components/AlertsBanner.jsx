import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useState } from 'react'
import { alerts } from '../data/mockData'
import clsx from 'clsx'

const levelConfig = {
  error:   { icon: AlertCircle,   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500' },
}

export default function AlertsBanner() {
  const [dismissed, setDismissed] = useState([])
  const visible = alerts.filter(a => !dismissed.includes(a.id))

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(alert => {
        const cfg = levelConfig[alert.level] || levelConfig.info
        const Icon = cfg.icon
        return (
          <div
            key={alert.id}
            className={clsx(
              'flex items-start gap-3 px-4 py-3 rounded-2xl border',
              cfg.bg, cfg.border
            )}
          >
            <Icon className={clsx('w-4 h-4 mt-0.5 shrink-0', cfg.text)} />
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium', cfg.text)}>{alert.message}</p>
              <p className="text-xs text-slate-400 mt-0.5">Source: {alert.agent}</p>
            </div>
            <button
              onClick={() => setDismissed(d => [...d, alert.id])}
              className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
