import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import {
  FileText, Calendar, TrendingUp, Download, AlertTriangle,
  CheckCircle2, Clock, DollarSign, Printer,
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { useKPIs } from '../hooks/useKPIs'
import { useTransactions } from '../hooks/useTransactions'
import { useApprovals } from '../hooks/useApprovals'
import {
  transactions as mockTransactions,
  pendingApprovals as mockApprovals,
  alerts as mockAlerts,
  revenueExpensesData,
} from '../data/mockData'
import { isConfigured } from '../lib/supabase'
import clsx from 'clsx'

// ── Shared helpers ────────────────────────────────────────────────────────────

const fmt = (n) => {
  const num = Number(n ?? 0)
  if (num >= 1_000_000) return `€ ${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000)     return `€ ${Math.round(num / 1_000)}k`
  return `€ ${Math.round(num).toLocaleString()}`
}

function Card({ className, children }) {
  return (
    <div className={clsx('bg-white rounded-3xl border border-slate-100 shadow-card p-6', className)}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 className="text-sm font-bold text-slate-700 mb-4">{children}</h3>
}

function StatRow({ label, value, alert }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={clsx('text-xs font-bold', alert ? 'text-red-600' : 'text-slate-800')}>{value}</span>
    </div>
  )
}

function Badge({ children, variant = 'blue' }) {
  const styles = {
    blue:   'bg-brand-50 text-brand-700 border-brand-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', styles[variant])}>
      {children}
    </span>
  )
}

// ── 1. Daily Operational Report ───────────────────────────────────────────────

function DailyReport({ kpis, transactions, approvals, loading }) {
  const today = new Date().toISOString().slice(0, 10)

  const txns        = transactions ?? mockTransactions
  const apprs       = approvals   ?? mockApprovals
  const alertItems  = mockAlerts

  const dueToday    = txns.filter(t => t.date === today)
  const unmatched   = txns.filter(t => t.status === 'unmatched')
  const overdue     = txns.filter(t => t.status === 'overdue')

  const cashKPI     = kpis.find(k => k.id === 'cash_position')

  const alertLevelStyle = {
    error:   { bg: 'bg-red-50',    border: 'border-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
    warning: { bg: 'bg-amber-50',  border: 'border-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
    info:    { bg: 'bg-brand-50',  border: 'border-brand-100', text: 'text-brand-700', dot: 'bg-brand-400' },
  }

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Cash Position',      value: cashKPI?.value ?? '€ 2,041,500', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Due Today',          value: dueToday.length,                 icon: Calendar,   color: 'text-brand-600 bg-brand-50' },
          { label: 'Pending Approvals',  value: apprs.length,                    icon: Clock,      color: 'text-amber-600 bg-amber-50' },
          { label: 'Unmatched Payments', value: unmatched.length,                icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className={clsx('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">{label}</p>
              <p className="text-lg font-bold text-slate-800">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Active Alerts */}
        <Card>
          <SectionTitle>Active Alerts</SectionTitle>
          {alertItems.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All clear — no alerts
            </div>
          ) : (
            <ul className="space-y-2">
              {alertItems.map(a => {
                const s = alertLevelStyle[a.level] ?? alertLevelStyle.info
                return (
                  <li key={a.id} className={clsx('flex items-start gap-3 p-3 rounded-2xl border', s.bg, s.border)}>
                    <div className={clsx('mt-1 w-2 h-2 rounded-full shrink-0', s.dot)} />
                    <div>
                      <p className={clsx('text-xs font-semibold', s.text)}>{a.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.agent}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Pending Approvals */}
        <Card>
          <SectionTitle>Pending Approvals ({apprs.length})</SectionTitle>
          {apprs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">No pending approvals</p>
          ) : (
            <ul className="space-y-2">
              {apprs.map(a => (
                <li key={a.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{a.vendor}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due {a.due}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">{a.amount}</p>
                    <Badge variant={a.urgency === 'high' ? 'red' : a.urgency === 'medium' ? 'amber' : 'slate'}>
                      {a.urgency === 'high' ? 'Urgent' : a.urgency === 'medium' ? 'Due soon' : 'Normal'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Transactions due today / overdue */}
      <Card>
        <SectionTitle>Overdue &amp; Due Today</SectionTitle>
        {overdue.length + dueToday.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">Nothing overdue or due today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Counterparty</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...overdue, ...dueToday].map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-4 text-slate-500">{t.date}</td>
                    <td className="py-2 pr-4 font-medium text-slate-700 truncate max-w-[160px]">{t.counterparty}</td>
                    <td className="py-2 pr-4 text-slate-500 truncate max-w-[200px]">{t.description}</td>
                    <td className={clsx('py-2 pr-4 text-right font-bold', t.amount < 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {t.amount < 0 ? '-' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                    <td className="py-2">
                      <Badge variant={t.status === 'overdue' ? 'red' : 'amber'}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── 2. Monthly Close Report ───────────────────────────────────────────────────

const plData = [
  { category: 'Revenue',   actual: 580, budget: 550 },
  { category: 'COGS',      actual: 214, budget: 200 },
  { category: 'Gross Profit', actual: 366, budget: 350 },
  { category: 'OpEx',      actual: 272, budget: 260 },
  { category: 'EBITDA',    actual: 94,  budget: 90  },
]

const balanceSheet = {
  assets: [
    { label: 'Cash & equivalents',  value: '€ 2,041,500' },
    { label: 'Accounts receivable', value: '€ 312,800' },
    { label: 'Inventory',           value: '€ 84,200' },
    { label: 'Fixed assets (net)',  value: '€ 641,000' },
    { label: 'Total assets',        value: '€ 3,079,500', bold: true },
  ],
  liabilities: [
    { label: 'Accounts payable',    value: '€ 148,320' },
    { label: 'Short-term loans',    value: '€ 200,000' },
    { label: 'Long-term debt',      value: '€ 500,000' },
    { label: 'Equity',              value: '€ 2,231,180', bold: true },
    { label: 'Total L + E',         value: '€ 3,079,500', bold: true },
  ],
}

const fxData = [
  { currency: 'USD/EUR', openRate: 0.916, closeRate: 0.921, exposure: '$ 450,000', impact: '+€ 2,250' },
  { currency: 'GBP/EUR', openRate: 1.168, closeRate: 1.172, exposure: '£ 130,000', impact: '+€ 520' },
  { currency: 'CHF/EUR', openRate: 1.044, closeRate: 1.041, exposure: 'CHF 80,000', impact: '-€ 240' },
]

const reconciliation = [
  { account: 'EUR Main (DE 12345)', bankBalance: '€ 1,420,000', bookBalance: '€ 1,418,760', variance: '€ 1,240',   status: 'reconciled' },
  { account: 'USD Ops (US 67890)',  bankBalance: '$ 450,000',   bookBalance: '$ 450,000',   variance: '—',         status: 'reconciled' },
  { account: 'GBP Reserve (GB 11)', bankBalance: '£ 130,000',  bookBalance: '£ 130,000',   variance: '—',         status: 'reconciled' },
]

function MonthlyReport({ kpis }) {
  const handlePrint = () => window.print()

  return (
    <div className="space-y-5 print:space-y-4" id="monthly-report">
      {/* Header actions */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs text-slate-400">Period: February 2026</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save PDF
        </button>
      </div>

      {/* P&L vs Budget */}
      <Card>
        <SectionTitle>P&amp;L vs Budget — February 2026 (€ 000s)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={plData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 11 }}
              formatter={(v) => [`€ ${v}k`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="actual" name="Actual" fill="#3d6bde" radius={[6, 6, 0, 0]} />
            <Bar dataKey="budget" name="Budget" fill="#c7d4f8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {plData.map(row => (
            <div key={row.category} className="bg-slate-50 rounded-2xl p-3">
              <p className="text-[10px] text-slate-400 font-medium mb-1">{row.category}</p>
              <p className="text-sm font-bold text-slate-800">€ {row.actual}k</p>
              <p className={clsx('text-[10px] font-semibold', row.actual >= row.budget ? 'text-emerald-600' : 'text-red-500')}>
                {row.actual >= row.budget ? '▲' : '▼'} vs € {row.budget}k budget
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Balance Sheet */}
        <Card>
          <SectionTitle>Balance Sheet Summary</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assets</p>
              {balanceSheet.assets.map(r => (
                <StatRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Liabilities &amp; Equity</p>
              {balanceSheet.liabilities.map(r => (
                <StatRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          </div>
        </Card>

        {/* FX Differences */}
        <Card>
          <SectionTitle>FX Revaluation</SectionTitle>
          <div className="space-y-3">
            {fxData.map(fx => (
              <div key={fx.currency} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                <div>
                  <p className="text-xs font-bold text-slate-700">{fx.currency}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {fx.openRate} → {fx.closeRate} · Exposure {fx.exposure}
                  </p>
                </div>
                <span className={clsx(
                  'text-xs font-bold',
                  fx.impact.startsWith('+') ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {fx.impact}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">Net FX impact</span>
              <span className="text-xs font-bold text-emerald-600">+€ 2,530</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bank Reconciliation */}
      <Card>
        <SectionTitle>Bank Reconciliation Status</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4 text-right">Bank Balance</th>
                <th className="pb-2 pr-4 text-right">Book Balance</th>
                <th className="pb-2 pr-4 text-right">Variance</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.map(r => (
                <tr key={r.account} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{r.account}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">{r.bankBalance}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">{r.bookBalance}</td>
                  <td className="py-2.5 pr-4 text-right font-bold text-slate-800">{r.variance}</td>
                  <td className="py-2.5">
                    <Badge variant="green">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1 inline" />
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── 3. Quarterly Board Report ─────────────────────────────────────────────────

const arApEvolution = [
  { quarter: 'Q1 25', ar: 285, ap: 112 },
  { quarter: 'Q2 25', ar: 310, ap: 128 },
  { quarter: 'Q3 25', ar: 298, ap: 134 },
  { quarter: 'Q4 25', ar: 322, ap: 141 },
  { quarter: 'Q1 26', ar: 313, ap: 148 },
]

const cashForecast = [
  { month: 'Mar', low: 1900, mid: 2100, high: 2300 },
  { month: 'Apr', low: 1850, mid: 2050, high: 2280 },
  { month: 'May', low: 1950, mid: 2200, high: 2450 },
  { month: 'Jun', low: 2050, mid: 2350, high: 2620 },
]

const quarterlyKPIs = [
  { label: 'Revenue',       q1: '€ 1.54M', q4prev: '€ 1.39M', change: '+10.8%', up: true },
  { label: 'Gross Margin',  q1: '63.1%',   q4prev: '61.4%',   change: '+1.7pp', up: true },
  { label: 'EBITDA',        q1: '€ 280k',  q4prev: '€ 241k',  change: '+16.2%', up: true },
  { label: 'Cash',          q1: '€ 2.04M', q4prev: '€ 1.82M', change: '+12.1%', up: true },
  { label: 'AR Days (DSO)', q1: '38 days', q4prev: '41 days',  change: '-3 days', up: true },
  { label: 'AP Days (DPO)', q1: '29 days', q4prev: '27 days',  change: '+2 days', up: false },
]

function QuarterlyReport() {
  const handleExport = () => window.print()

  return (
    <div className="space-y-5" id="quarterly-report">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-xs text-slate-400">Period: Q1 2026 (Jan – Mar)</p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export Report
        </button>
      </div>

      {/* Executive KPI grid */}
      <Card>
        <SectionTitle>Executive KPI Summary — Q1 2026 vs Q4 2025</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {quarterlyKPIs.map(k => (
            <div key={k.label} className="bg-slate-50 rounded-2xl p-3">
              <p className="text-[10px] text-slate-400 font-medium mb-1">{k.label}</p>
              <p className="text-sm font-bold text-slate-800">{k.q1}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Q4: {k.q4prev}</p>
              <p className={clsx('text-[10px] font-bold mt-1', k.up ? 'text-emerald-600' : 'text-red-500')}>
                {k.up ? '▲' : '▼'} {k.change}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Revenue trend */}
      <Card>
        <SectionTitle>Revenue vs Expenses — 6-Month Trend (€ 000s)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueExpensesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3d6bde" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3d6bde" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 11 }}
              formatter={(v) => [`€ ${v}k`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#3d6bde" strokeWidth={2} fill="url(#colorRev)" />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" strokeWidth={2} fill="url(#colorExp)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AR / AP evolution */}
        <Card>
          <SectionTitle>AR vs AP Evolution (€ 000s)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={arApEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 11 }}
                formatter={(v) => [`€ ${v}k`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ar" name="AR Outstanding" fill="#3d6bde" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ap" name="AP Outstanding" fill="#c7d4f8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Cash Forecast */}
        <Card>
          <SectionTitle>Cash Forecast — Next 4 Months (€ 000s)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cashForecast} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[1700, 2700]} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 11 }}
                formatter={(v) => [`€ ${v}k`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="high" name="Upside"   stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="mid"  name="Base"     stroke="#3d6bde" strokeWidth={2}   dot={{ r: 3, fill: '#3d6bde' }} />
              <Line type="monotone" dataKey="low"  name="Downside" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 mt-2">
            Base assumes stable revenue, seasonally adjusted OpEx, and current payment terms.
          </p>
        </Card>
      </div>
    </div>
  )
}

// ── Report selector tabs ──────────────────────────────────────────────────────

const REPORT_TYPES = [
  { id: 'daily',     label: 'Daily Operational',  icon: Calendar,  description: 'Cash, due today, approvals, alerts' },
  { id: 'monthly',   label: 'Monthly Close',       icon: FileText,  description: 'P&L, balance sheet, FX, bank rec' },
  { id: 'quarterly', label: 'Quarterly Board',     icon: TrendingUp, description: 'KPIs, trends, forecasts, charts' },
]

// ── Main export ───────────────────────────────────────────────────────────────

export default function Reports() {
  const [active, setActive] = useState('daily')

  const { kpis, loading: kpisLoading }           = useKPIs()
  const { data: transactions, loading: txLoading } = useTransactions({ limit: 100 })
  const { data: approvals, loading: appLoading }   = useApprovals()

  const loading = kpisLoading || txLoading || appLoading

  const subtitleMap = {
    daily:     'Daily Operational Report · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    monthly:   'Monthly Close Report · February 2026',
    quarterly: 'Quarterly Board Report · Q1 2026',
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar
        title="Reports"
        subtitle={subtitleMap[active]}
      />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">
        {/* Report type selector */}
        <div className="flex items-center gap-3 flex-wrap">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon
            const isActive = active === rt.id
            return (
              <button
                key={rt.id}
                onClick={() => setActive(rt.id)}
                className={clsx(
                  'flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {rt.label}
                {!isActive && <span className="hidden sm:inline text-[10px] font-normal text-slate-400 ml-1">— {rt.description}</span>}
              </button>
            )
          })}

          {loading && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5 ml-2">
              <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
              Syncing…
            </span>
          )}
        </div>

        {/* Report content */}
        {active === 'daily' && (
          <DailyReport
            kpis={kpis}
            transactions={isConfigured ? transactions : undefined}
            approvals={isConfigured ? approvals : undefined}
            loading={loading}
          />
        )}
        {active === 'monthly'   && <MonthlyReport kpis={kpis} />}
        {active === 'quarterly' && <QuarterlyReport />}
      </main>
    </div>
  )
}
