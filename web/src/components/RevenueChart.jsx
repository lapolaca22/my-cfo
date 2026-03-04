import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { revenueExpensesData } from '../data/mockData'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-card px-4 py-3 text-xs">
        <p className="font-bold text-slate-700 mb-2">{label} 2025–26</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
            <span className="text-slate-500 capitalize">{p.name}:</span>
            <span className="font-semibold text-slate-700">€ {p.value}k</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function RevenueChart() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Revenue vs Expenses</h3>
          <p className="text-xs text-slate-400 mt-0.5">Last 6 months · EUR thousands</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-500 inline-block" />
            <span className="text-slate-500 font-medium">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />
            <span className="text-slate-500 font-medium">Expenses</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={revenueExpensesData} barCategoryGap="30%" barGap={4}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={v => `€${v}k`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
          <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
