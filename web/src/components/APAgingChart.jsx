import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { apAgingData } from '../data/mockData'

const BAR_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-card px-3.5 py-2.5 text-xs">
        <p className="font-semibold text-slate-600 mb-1">{label}</p>
        <p className="font-bold text-slate-800">€ {payload[0].value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

export default function APAgingChart() {
  const total = apAgingData.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-slate-700">AP Aging Buckets</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Total outstanding: <span className="font-semibold text-slate-600">€ {total.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={apAgingData} barCategoryGap="35%">
          <XAxis
            dataKey="bucket"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
            {apAgingData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="grid grid-cols-5 gap-1 mt-2">
        {apAgingData.map((d, i) => (
          <div key={d.bucket} className="text-center">
            <div
              className="w-full h-1 rounded-full mb-1"
              style={{ background: BAR_COLORS[i] }}
            />
            <p className="text-[10px] text-slate-400 font-medium">
              {Math.round((d.amount / total) * 100)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
