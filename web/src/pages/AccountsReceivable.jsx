import { useState } from 'react'
import {
  Search, CheckCircle2, AlertTriangle, Clock, Link,
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowUpRight, Inbox,
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { useInvoices } from '../hooks/useInvoices'
import { useTransactions } from '../hooks/useTransactions'
import {
  arInvoices as mockArInvoices,
  bankPayments as mockBankPayments,
} from '../data/mockData'
import { isConfigured } from '../lib/supabase'
import clsx from 'clsx'

// ── Config ────────────────────────────────────────────────────────────────────

const INVOICE_STATUS_CFG = {
  sent:             { label: 'Sent',             bg: 'bg-brand-50',   text: 'text-brand-700',   dot: 'bg-brand-500' },
  partially_paid:   { label: 'Partial',          bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  matched:          { label: 'Paid / Matched',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  paid:             { label: 'Paid',             bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  overdue:          { label: 'Overdue',          bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
}

const PAYMENT_STATUS_CFG = {
  matched:           { label: 'Matched',          bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  partially_matched: { label: 'Partial Match',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',  icon: AlertTriangle },
  unmatched:         { label: 'Unmatched',        bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',    icon: AlertTriangle },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(amount, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : currency
  return `${sym} ${Number(amount).toLocaleString()}`
}

function normaliseARRow(row) {
  return {
    id:          row.invoice_number ?? row.id,
    customer:    row.vendor_or_customer ?? '—',
    amount:      Number(row.amount ?? 0),
    currency:    row.currency ?? 'EUR',
    date:        row.invoice_date ?? row.date,
    due:         row.due_date ?? row.due,
    status:      row.status,
    paidAmount:  0,
  }
}

function normaliseBankPayment(row) {
  // From unified_transactions view (type = 'AR', status = matched/unmatched)
  return {
    id:             row.id,
    date:           row.date,
    counterparty:   row.counterparty,
    amount:         Math.abs(Number(row.amount ?? 0)),
    currency:       row.currency ?? 'EUR',
    reference:      row.invoice ?? '—',
    status:         row.status === 'matched' ? 'matched' : row.status === 'unmatched' ? 'unmatched' : row.status,
    matchedInvoice: row.invoice !== '—' ? row.invoice : null,
  }
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
    : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
}

// ── AR Invoices sub-table ─────────────────────────────────────────────────────

function ARInvoiceTable({ invoices, loading }) {
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('All')
  const [sortField, setSortField]   = useState('due')
  const [sortDir, setSortDir]       = useState('asc')
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 8

  const STATUSES = ['All', 'Sent', 'Overdue', 'Partial', 'Paid / Matched']
  const statusKey = (l) => ({ All: 'All', Sent: 'sent', Overdue: 'overdue', Partial: 'partially_paid', 'Paid / Matched': 'matched' }[l])

  const filtered = invoices
    .filter(i => {
      if (statusFilter !== 'All' && i.status !== statusKey(statusFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return i.customer.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
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
    else { setSortField(f); setSortDir('asc') }
    setPage(0)
  }

  const columns = [
    { key: 'date',     label: 'Date',      sortable: true  },
    { key: 'id',       label: 'Invoice #', sortable: false },
    { key: 'customer', label: 'Customer',  sortable: true  },
    { key: 'amount',   label: 'Amount',    sortable: true  },
    { key: 'due',      label: 'Due Date',  sortable: true  },
    { key: 'progress', label: 'Collected', sortable: false },
    { key: 'status',   label: 'Status',    sortable: false },
  ]

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 flex-wrap gap-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Outgoing Invoices</h3>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(0) }}
                className={clsx('px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                  statusFilter === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search customer…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="pl-8 pr-4 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 w-40 transition-all" />
          </div>
        </div>
      </div>

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
              <tr><td colSpan={7} className="px-5 py-10 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  <span className="text-xs">Loading invoices…</span>
                </div>
              </td></tr>
            )}
            {!loading && pageData.map(inv => {
              const cfg = INVOICE_STATUS_CFG[inv.status] ?? INVOICE_STATUS_CFG.sent
              const collectedPct = inv.amount > 0 ? Math.round((inv.paidAmount / inv.amount) * 100) : 0
              const daysUntilDue = inv.due ? Math.ceil((new Date(inv.due) - new Date()) / 86_400_000) : null

              return (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{inv.date}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{inv.id}</td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 max-w-[180px]">
                    <span className="truncate block">{inv.customer}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                    {fmtAmt(inv.amount, inv.currency)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={clsx('text-xs font-medium',
                      daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-600 font-bold'
                        : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-600 font-semibold'
                        : 'text-slate-500')}>
                      {inv.due ?? '—'}
                    </span>
                  </td>
                  {/* Collection progress bar */}
                  <td className="px-5 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all', collectedPct >= 100 ? 'bg-emerald-500' : collectedPct > 0 ? 'bg-amber-400' : 'bg-slate-200')}
                          style={{ width: `${collectedPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{collectedPct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap', cfg.bg, cfg.text)}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!loading && pageData.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">No invoices match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
  )
}

// ── Bank Payments sub-table ───────────────────────────────────────────────────

function BankPaymentsTable({ payments, loading }) {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('All')
  const [page, setPage]           = useState(0)
  const PAGE_SIZE = 8

  // Local "match" overrides
  const [matchOverrides, setMatchOverrides] = useState({})
  const getPayment = (p) => ({ ...p, ...(matchOverrides[p.id] ?? {}) })

  const STATUSES = ['All', 'Matched', 'Partial Match', 'Unmatched']
  const statusKey = (l) => ({ All: 'All', Matched: 'matched', 'Partial Match': 'partially_matched', Unmatched: 'unmatched' }[l])

  const filtered = payments
    .map(getPayment)
    .filter(p => {
      if (statusFilter !== 'All' && p.status !== statusKey(statusFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return p.counterparty.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
      }
      return true
    })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleManualMatch = (payment) => {
    const ref = window.prompt(`Enter invoice number to match payment ${payment.id}:`, '')
    if (ref && ref.trim()) {
      setMatchOverrides(prev => ({
        ...prev,
        [payment.id]: { status: 'matched', matchedInvoice: ref.trim(), reference: ref.trim() },
      }))
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 flex-wrap gap-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Bank Payments Received</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.filter(p => p.status === 'unmatched').length} unmatched · {filtered.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(0) }}
                className={clsx('px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                  statusFilter === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="pl-8 pr-4 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 w-36 transition-all" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {['Date', 'Payment ID', 'From', 'Amount', 'Reference', 'Matched Invoice', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-5 py-10 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  <span className="text-xs">Loading payments…</span>
                </div>
              </td></tr>
            )}
            {!loading && pageData.map(pmt => {
              const cfg = PAYMENT_STATUS_CFG[pmt.status] ?? PAYMENT_STATUS_CFG.unmatched
              const StatusIcon = cfg.icon
              const isUnmatched = pmt.status === 'unmatched'

              return (
                <tr key={pmt.id} className={clsx('border-b border-slate-50 hover:bg-slate-50/70 transition-colors', isUnmatched && 'bg-red-50/30')}>
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{pmt.date}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{pmt.id}</td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 max-w-[160px]">
                    <span className="truncate block">{pmt.counterparty}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-emerald-600 whitespace-nowrap">
                    +{fmtAmt(pmt.amount, pmt.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{pmt.reference}</td>
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    {pmt.matchedInvoice ? (
                      <span className="flex items-center gap-1 text-brand-600 font-medium">
                        <Link className="w-3 h-3" /> {pmt.matchedInvoice}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap', cfg.bg, cfg.text)}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {isUnmatched && (
                      <button
                        onClick={() => handleManualMatch(pmt)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-100 text-brand-700 text-[10px] font-bold hover:bg-brand-200 transition-colors whitespace-nowrap"
                      >
                        <Link className="w-3 h-3" /> Match
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && pageData.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">No payments match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountsReceivable() {
  const { data: liveInvoices, loading: invLoading } = useInvoices({ type: 'customer' })
  const { data: liveTxns,     loading: txLoading  } = useTransactions({ limit: 100 })

  const arInvoices = (isConfigured && liveInvoices.length > 0)
    ? liveInvoices.map(normaliseARRow)
    : mockArInvoices

  const bankPayments = (isConfigured && liveTxns.length > 0)
    ? liveTxns.filter(t => t.type === 'AR').map(normaliseBankPayment)
    : mockBankPayments

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalAR      = arInvoices.filter(i => !['paid', 'matched'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const totalMatched = bankPayments.filter(p => p.status === 'matched').length
  const unmatched    = bankPayments.filter(p => p.status === 'unmatched').length
  const overdue      = arInvoices.filter(i => i.status === 'overdue').length

  const fmtAmt2 = (n) => {
    if (n >= 1_000_000) return `€ ${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000)     return `€ ${Math.round(n / 1_000)}k`
    return `€ ${n.toLocaleString()}`
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar title="Accounts Receivable" subtitle="AR Agent · Customer invoices, bank reconciliation" />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total AR Outstanding', value: fmtAmt2(totalAR),   icon: ArrowUpRight,  color: 'text-brand-600 bg-brand-50' },
            { label: 'Payments Matched',     value: totalMatched,        icon: CheckCircle2,  color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Unmatched Payments',   value: unmatched,           icon: AlertTriangle, color: unmatched > 0 ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50' },
            { label: 'Overdue Invoices',     value: overdue,             icon: Clock,         color: overdue > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50' },
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

        <ARInvoiceTable invoices={arInvoices} loading={invLoading && isConfigured} />
        <BankPaymentsTable payments={bankPayments} loading={txLoading && isConfigured} />

      </main>
    </div>
  )
}
