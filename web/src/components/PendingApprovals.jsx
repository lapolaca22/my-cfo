import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { pendingApprovals } from '../data/mockData'
import clsx from 'clsx'

const urgencyConfig = {
  high:   { label: 'Urgent', dot: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50' },
  medium: { label: 'Due soon', dot: 'bg-amber-500', text: 'text-amber-600',  bg: 'bg-amber-50' },
  low:    { label: 'Normal',  dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50' },
}

export default function PendingApprovals() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Pending Approvals</h3>
          <p className="text-xs text-slate-400 mt-0.5">4-eyes approval required</p>
        </div>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
          {pendingApprovals.length}
        </span>
      </div>

      <ul className="space-y-3">
        {pendingApprovals.map(item => {
          const cfg = urgencyConfig[item.urgency] || urgencyConfig.low
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className={clsx('mt-1 w-2 h-2 rounded-full shrink-0', cfg.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 truncate">{item.vendor}</p>
                  <span className={clsx('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-slate-800">{item.amount}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    Due {item.due}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2 mt-4">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approve All
        </button>
        <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
          Review
        </button>
      </div>
    </div>
  )
}
