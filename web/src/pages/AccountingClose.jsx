import { useState } from 'react'
import {
  Search, CheckCircle2, Circle, ChevronUp, ChevronDown,
  ChevronsUpDown, BookOpen, ChevronRight,
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { useJournalEntries } from '../hooks/useJournalEntries'
import {
  journalEntries as mockJournalEntries,
  monthlyCloseChecklist as mockChecklist,
} from '../data/mockData'
import { isConfigured } from '../lib/supabase'
import clsx from 'clsx'

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  FX:           { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  Payroll:      { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  Depreciation: { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'  },
  Revaluation:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Accrual:      { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'  },
  GL:           { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'  },
}

const STATUS_CFG = {
  posted:  { label: 'Posted',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: 'Pending', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(amount, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : currency
  return `${sym} ${Number(amount).toLocaleString()}`
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
    : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
}

// ── Monthly Close Checklist ───────────────────────────────────────────────────

function CloseChecklist() {
  const [checklist, setChecklist] = useState(mockChecklist)
  const [collapsed, setCollapsed] = useState(false)

  const doneCount = checklist.filter(i => i.done).length
  const pct       = Math.round((doneCount / checklist.length) * 100)

  const toggle = (id) => setChecklist(prev =>
    prev.map(item => item.id === id ? { ...item, done: !item.done } : item)
  )

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700 text-left">Monthly Close Checklist</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {doneCount}/{checklist.length} tasks complete · February 2026
            </p>
          </div>
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 w-48">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={clsx('text-xs font-bold', pct === 100 ? 'text-emerald-600' : 'text-brand-600')}>{pct}%</span>
          </div>
        </div>
        <ChevronRight className={clsx('w-4 h-4 text-slate-400 transition-transform', !collapsed && 'rotate-90')} />
      </button>

      {!collapsed && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {checklist.map(item => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-2xl border text-left transition-all',
                  item.done
                    ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                )}
              >
                {item.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  : <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={clsx('text-xs font-semibold', item.done ? 'text-emerald-700 line-through' : 'text-slate-700')}>
                    {item.task}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.agent}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Journal Entries Table ─────────────────────────────────────────────────────

export default function AccountingClose() {
  const { data: liveEntries, loading } = useJournalEntries({ limit: 100 })

  const entries = (isConfigured && liveEntries.length > 0)
    ? liveEntries
    : mockJournalEntries

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatus]   = useState('All')
  const [sortField, setSortField]   = useState('date')
  const [sortDir, setSortDir]       = useState('desc')
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 8

  // Local post/unpost overrides
  const [statusOverrides, setStatusOverrides] = useState({})
  const getEntry = (e) => ({ ...e, ...(statusOverrides[e.id] ?? {}) })

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const displayed = entries.map(getEntry)
  const totalPosted  = displayed.filter(e => e.status === 'posted').length
  const totalPending = displayed.filter(e => e.status === 'pending').length
  const totalDebits  = displayed.filter(e => e.status === 'posted').reduce((s, e) => s + e.amount, 0)

  const TYPES    = ['All', 'FX', 'Payroll', 'Depreciation', 'Revaluation', 'Accrual']
  const STATUSES = ['All', 'Posted', 'Pending']

  const filtered = displayed
    .filter(e => {
      if (typeFilter !== 'All' && e.type !== typeFilter) return false
      if (statusFilter !== 'All' && e.status !== statusFilter.toLowerCase()) return false
      if (search) {
        const q = search.toLowerCase()
        return e.description.toLowerCase().includes(q)
          || e.id.toLowerCase().includes(q)
          || e.debitAccount.toLowerCase().includes(q)
          || e.creditAccount.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField]
      if (sortField === 'amount') { va = Number(va); vb = Number(vb) }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (f) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
    setPage(0)
  }

  const togglePost = (entry) => {
    setStatusOverrides(prev => ({
      ...prev,
      [entry.id]: { status: entry.status === 'posted' ? 'pending' : 'posted' },
    }))
  }

  const columns = [
    { key: 'date',          label: 'Date',         sortable: true  },
    { key: 'id',            label: 'Entry #',      sortable: false },
    { key: 'type',          label: 'Type',         sortable: false },
    { key: 'description',   label: 'Description',  sortable: false },
    { key: 'debitAccount',  label: 'Debit',        sortable: false },
    { key: 'creditAccount', label: 'Credit',       sortable: false },
    { key: 'amount',        label: 'Amount',       sortable: true  },
    { key: 'status',        label: 'Status',       sortable: false },
    { key: 'actions',       label: '',             sortable: false },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar title="Accounting & Close" subtitle="Accounting Agent · Journal entries, depreciation, payroll, FX" />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Entries Posted',   value: totalPosted,           icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Pending Entries',  value: totalPending,          icon: Circle,       color: totalPending > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50' },
            { label: 'Total Debits',     value: fmtAmt(totalDebits),   icon: BookOpen,     color: 'text-brand-600 bg-brand-50' },
            { label: 'Entries in View',  value: entries.length,        icon: BookOpen,     color: 'text-slate-600 bg-slate-100' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 flex items-center gap-4">
              <div className={clsx('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                <p className="text-lg font-bold text-slate-800">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly close checklist */}
        <CloseChecklist />

        {/* Journal entries table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 flex-wrap gap-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Journal Entries</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} entries</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type filter */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
                {TYPES.map(t => (
                  <button key={t} onClick={() => { setTypeFilter(t); setPage(0) }}
                    className={clsx('px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                      typeFilter === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {t}
                  </button>
                ))}
              </div>
              {/* Status filter */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => { setStatus(s); setPage(0) }}
                    className={clsx('px-3 py-1 rounded-xl text-xs font-semibold transition-all',
                      statusFilter === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input type="text" placeholder="Search entries…" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  className="pl-8 pr-4 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 w-44 transition-all" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {columns.map(col => (
                    <th key={col.key} className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {col.sortable ? (
                        <button className="flex items-center gap-1 hover:text-slate-600 transition-colors" onClick={() => handleSort(col.key)}>
                          {col.label} <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-5 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                      <span className="text-xs">Loading journal entries…</span>
                    </div>
                  </td></tr>
                )}
                {!loading && pageData.map(entry => {
                  const typeCfg   = TYPE_CFG[entry.type]   ?? TYPE_CFG.GL
                  const statusCfg = STATUS_CFG[entry.status] ?? STATUS_CFG.pending

                  return (
                    <tr key={entry.id} className={clsx(
                      'group border-b border-slate-50 hover:bg-slate-50/70 transition-colors',
                      entry.status === 'pending' && 'bg-amber-50/20'
                    )}>
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{entry.date}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{entry.id}</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold', typeCfg.bg, typeCfg.text)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', typeCfg.dot)} />
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[220px]">
                        <span className="truncate block">{entry.description}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[140px]">
                        <span className="truncate block font-medium">{entry.debitAccount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[140px]">
                        <span className="truncate block font-medium">{entry.creditAccount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                        {fmtAmt(entry.amount, entry.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap', statusCfg.bg, statusCfg.text)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', statusCfg.dot)} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => togglePost(entry)}
                          className={clsx(
                            'opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap',
                            entry.status === 'posted'
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          )}
                        >
                          {entry.status === 'posted' ? 'Unpost' : 'Post'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && pageData.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">No entries match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">Prev</button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    className={clsx('w-7 h-7 rounded-xl text-xs font-semibold transition-colors',
                      i === page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200')}>{i + 1}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page === pageCount - 1}
                  className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
