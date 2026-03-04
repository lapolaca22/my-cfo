import { useState } from 'react'
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  MoreHorizontal,
} from 'lucide-react'
import { transactions } from '../data/mockData'
import clsx from 'clsx'

// ── Status badge config ────────────────────────────────────────────────────
const statusConfig = {
  queued:           { label: 'Queued',           bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  matched:          { label: 'Matched',          bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending_approval: { label: 'Pending Approval', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  posted:           { label: 'Posted',           bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  unmatched:        { label: 'Unmatched',        bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500' },
  paid:             { label: 'Paid',             bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  overdue:          { label: 'Overdue',          bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-600' },
}

// ── Type badge config ──────────────────────────────────────────────────────
const typeConfig = {
  AP: { label: 'AP', icon: ArrowDownLeft, bg: 'bg-rose-50',  text: 'text-rose-600' },
  AR: { label: 'AR', icon: ArrowUpRight,  bg: 'bg-brand-50', text: 'text-brand-600' },
  GL: { label: 'GL', icon: BookOpen,      bg: 'bg-slate-100', text: 'text-slate-500' },
}

const TYPE_FILTERS = ['All', 'AP', 'AR', 'GL']

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
    : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
}

export default function TransactionsTable({ maxRows }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)

  const PAGE_SIZE = maxRows || 8

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  const filtered = transactions
    .filter(t => {
      if (typeFilter !== 'All' && t.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.counterparty.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.invoice.toLowerCase().includes(q)
        )
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
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
      {/* Table header bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Transactions</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} entries · all agents
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
            {TYPE_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setTypeFilter(f); setPage(0) }}
                className={clsx(
                  'px-3 py-1 rounded-xl text-xs font-semibold transition-all',
                  typeFilter === f
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="pl-8 pr-4 py-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 w-40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {[
                { key: 'date',         label: 'Date',       sortable: true  },
                { key: 'type',         label: 'Type',       sortable: false },
                { key: 'counterparty', label: 'Counterparty', sortable: true },
                { key: 'description',  label: 'Description',  sortable: false },
                { key: 'invoice',      label: 'Reference',    sortable: false },
                { key: 'amount',       label: 'Amount',      sortable: true  },
                { key: 'status',       label: 'Status',      sortable: false },
                { key: 'agent',        label: 'Agent',       sortable: false },
                { key: 'actions',      label: '',            sortable: false },
              ].map(col => (
                <th
                  key={col.key}
                  className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.sortable ? (
                    <button
                      className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((txn, idx) => {
              const typeCfg = typeConfig[txn.type] || typeConfig.GL
              const TypeIcon = typeCfg.icon
              const statusCfg = statusConfig[txn.status] || statusConfig.posted
              const isPositive = txn.amount > 0

              return (
                <tr
                  key={txn.id}
                  className={clsx(
                    'group border-b border-slate-50 hover:bg-slate-50/70 transition-colors',
                    idx % 2 === 0 ? '' : ''
                  )}
                >
                  {/* Date */}
                  <td className="px-5 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                    {txn.date}
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold',
                      typeCfg.bg, typeCfg.text
                    )}>
                      <TypeIcon className="w-3 h-3" />
                      {typeCfg.label}
                    </span>
                  </td>

                  {/* Counterparty */}
                  <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 max-w-[160px]">
                    <span className="truncate block">{txn.counterparty}</span>
                  </td>

                  {/* Description */}
                  <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[200px]">
                    <span className="truncate block">{txn.description}</span>
                  </td>

                  {/* Reference */}
                  <td className="px-5 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                    {txn.invoice}
                  </td>

                  {/* Amount */}
                  <td className="px-5 py-3.5 text-xs font-bold whitespace-nowrap">
                    <span className={isPositive ? 'text-emerald-600' : 'text-slate-700'}>
                      {isPositive ? '+' : ''}
                      {txn.currency === 'EUR' ? '€' : txn.currency}{' '}
                      {Math.abs(txn.amount).toLocaleString()}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap',
                      statusCfg.bg, statusCfg.text
                    )}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', statusCfg.dot)} />
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Agent */}
                  <td className="px-5 py-3.5 text-[11px] text-slate-400 whitespace-nowrap">
                    {txn.agent}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <button className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-lg hover:bg-slate-200 transition-all">
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </td>
                </tr>
              )
            })}

            {pageData.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">
                  No transactions match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={clsx(
                  'w-7 h-7 rounded-xl text-xs font-semibold transition-colors',
                  i === page
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200'
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
