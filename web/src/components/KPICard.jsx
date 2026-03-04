import { TrendingUp, TrendingDown, FileText, Clock, Landmark, BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts'
import { sparklines } from '../data/mockData'
import clsx from 'clsx'

const iconMap = {
  'file-text':   FileText,
  'clock':       Clock,
  'landmark':    Landmark,
  'trending-up': BarChart3,
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   spark: '#2563eb', border: 'border-blue-100' },
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600', spark: '#4f46e5', border: 'border-indigo-100' },
  emerald:{ bg: 'bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600', spark: '#059669', border: 'border-emerald-100' },
  violet: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', spark: '#7c3aed', border: 'border-violet-100' },
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700">
        {payload[0].value}
      </div>
    )
  }
  return null
}

export default function KPICard({ kpi }) {
  const Icon = iconMap[kpi.icon] || BarChart3
  const colors = colorMap[kpi.color] || colorMap.blue
  const sparkData = (sparklines[kpi.id] || []).map((v, i) => ({ i, v }))

  return (
    <div
      className={clsx(
        'relative bg-white rounded-3xl border border-slate-100 shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200',
        'p-5 flex flex-col gap-4 overflow-hidden'
      )}
    >
      {/* Subtle color wash top-right */}
      <div
        className={clsx(
          'absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-30',
          colors.bg
        )}
      />

      {/* Header row */}
      <div className="flex items-start justify-between relative">
        <div className={clsx('flex items-center justify-center w-10 h-10 rounded-2xl', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1 mt-1">
          {kpi.trendUp
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          }
          <span
            className={clsx(
              'text-xs font-semibold',
              kpi.trendUp ? 'text-emerald-600' : 'text-red-500'
            )}
          >
            {kpi.trend}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="relative">
        <p className="text-2xl font-bold text-slate-800 leading-none tracking-tight">
          {kpi.value}
        </p>
        <p className="text-xs text-slate-400 font-medium mt-1.5">{kpi.subValue}</p>
      </div>

      {/* Sparkline */}
      <div className="h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
            <defs>
              <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors.spark} stopOpacity={0.18} />
                <stop offset="95%" stopColor={colors.spark} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={colors.spark}
              strokeWidth={2}
              fill={`url(#grad-${kpi.id})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Detail rows */}
      <div className={clsx('rounded-2xl border p-3 space-y-2', colors.border, colors.bg)}>
        {kpi.detail.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">{row.label}</span>
            <span
              className={clsx(
                'text-[11px] font-bold',
                row.alert ? 'text-red-500' : 'text-slate-700'
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Label + trend period */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">{kpi.label}</p>
        <p className="text-[10px] text-slate-400">{kpi.trendLabel}</p>
      </div>
    </div>
  )
}
