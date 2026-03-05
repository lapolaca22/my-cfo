import { useState, useEffect } from 'react'
import {
  Search, CheckCircle2, XCircle, Clock, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertTriangle, FileText, Users,
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { useInvoices } from '../hooks/useInvoices'
import { apInvoices as mockApInvoices } from '../data/mockData'
import { supabase, isConfigured } from '../lib/supabase'
import clsx from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const REQUIRED_APPROVALS = 2

const STATUS_CFG = {
  draft:            { label: 'Draft',            bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
  pending_approval: { label: 'Pending Approval', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  approved:         { label: 'Approved',         bg: 'bg-brand-50',   text: 'text-brand-700',   dot: 'bg-brand-500' },
  queued:           { label: 'Payment Queued',   bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  paid:             { label: 'Paid',             bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  overdue:          { label: 'Overdue',          bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-600' },
  rejected:         { label: 'Rejected',         bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(amount, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : currency
  return `${sym} ${Number(amount).toLocaleString()}`
}

function normaliseSupplierRow(row) {
  // Supabase row → local shape. rawId preserves UUID for approval_requests FK.
  return {
    rawId:    row.id,
    id:       row.invoice_number ?? row.id,
    vendor:   row.vendor_or_customer ?? '—',
    amount:   Number(row.amount ?? 0),
    currency: row.currency ?? 'EUR',
    date:     row.invoice_date ?? row.date,
    due:      row.due_date ?? row.due,
    status:   row.status,
    approvedBy: [],
    decisions:  [],
  }
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
    : <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
}

// ── Supabase: save approval request ──────────────────────────────────────────

async function saveApprovalRequest({ invoiceRawId, decisions, status, amountHint }) {
  if (!isConfigured || !invoiceRawId) return

  // Check if a record already exists for this invoice
  const { data: existing } = await supabase
    .from('approval_requests')
    .select('id')
    .eq('invoice_id', invoiceRawId)
    .maybeSingle()

  const payload = {
    invoice_id:   invoiceRawId,
    subject_type: 'invoice',
    decisions,
    status,
    amount_hint:  amountHint,
    updated_at:   new Date().toISOString(),
  }

  if (existing) {
    await supabase
      .from('approval_requests')
      .update(payload)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('approval_requests')
      .insert({ ...payload, created_at: new Date().toISOString() })
  }
}

// ── Approval Modal ────────────────────────────────────────────────────────────

function ApprovalModal({ invoice, type, onConfirm, onCancel }) {
  const [name, setName]     = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const approvedBy = invoice.approvedBy ?? []

  const handleConfirm = async () => {
    if (!name.trim()) return
    setError(null)
    setSaving(true)
    try {
      await onConfirm(name.trim(), reason.trim())
    } catch (err) {
      setError(err.message ?? 'Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className={clsx(
            'w-10 h-10 rounded-2xl flex items-center justify-center',
            type === 'approve' ? 'bg-emerald-100' : 'bg-red-100'
          )}>
            {type === 'approve'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : <XCircle className="w-5 h-5 text-red-500" />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {type === 'approve' ? 'Approve Invoice' : 'Reject Invoice'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoice.vendor} · {fmtAmt(invoice.amount, invoice.currency)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* 4-eyes progress — shown in approve modal */}
          {type === 'approve' && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: REQUIRED_APPROVALS }, (_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2',
                      i < approvedBy.length
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
                        : i === approvedBy.length
                          ? 'bg-brand-50 border-brand-300 text-brand-600 ring-2 ring-brand-200'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                    )}
                    title={approvedBy[i] ?? (i === approvedBy.length ? 'You' : 'Pending')}
                  >
                    {i < approvedBy.length ? '✓' : i === approvedBy.length ? '?' : '·'}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-700">
                  {approvedBy.length}/{REQUIRED_APPROVALS} approvals
                  {approvedBy.length === 0 && ' — first approval'}
                  {approvedBy.length === 1 && ' — final approval needed'}
                </p>
                {approvedBy.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Approved by: {approvedBy.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Your name / approver ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. J. Müller"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus
              className="w-full px-3 py-2 rounded-2xl border border-slate-200 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
          </div>

          {type === 'reject' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Explain why this invoice is being rejected…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-2xl border border-slate-200 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 resize-none transition-all"
              />
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || (type === 'reject' && !reason.trim()) || saving}
            className={clsx(
              'flex-1 py-2 rounded-2xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5',
              type === 'approve'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-500 text-white hover:bg-red-600'
            )}
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {type === 'approve'
              ? approvedBy.length + 1 >= REQUIRED_APPROVALS ? 'Approve & Finalise' : 'Approve (1st of 2)'
              : 'Confirm Rejection'
            }
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountsPayable() {
  const { data: liveData, loading } = useInvoices({ type: 'supplier' })

  // Base data: prefer Supabase, fall back to mock
  const baseInvoices = (isConfigured && liveData.length > 0)
    ? liveData.map(normaliseSupplierRow)
    : mockApInvoices

  // Local approval overrides — keyed by invoice id (invoice number string)
  // Each entry: { approvedBy: string[], decisions: object[], status: string }
  const [overrides, setOverrides]       = useState({})
  const [modal, setModal]               = useState(null)   // { type, invoice }
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortField, setSortField]       = useState('due')
  const [sortDir, setSortDir]           = useState('asc')
  const [page, setPage]                 = useState(0)
  const PAGE_SIZE = 8

  // Load existing approval decisions from Supabase when live data changes
  useEffect(() => {
    if (!isConfigured || !liveData.length) return
    const rawIds = liveData.map(r => r.id).filter(Boolean)
    if (!rawIds.length) return

    supabase
      .from('approval_requests')
      .select('invoice_id, status, decisions')
      .in('invoice_id', rawIds)
      .then(({ data }) => {
        if (!data?.length) return
        const newOverrides = {}
        data.forEach(req => {
          const inv = liveData.find(r => r.id === req.invoice_id)
          if (!inv) return
          const localKey = inv.invoice_number ?? inv.id
          const approvedDecisions = (req.decisions ?? []).filter(d => d.decision === 'approved')
          newOverrides[localKey] = {
            approvedBy: approvedDecisions.map(d => d.approver_name),
            decisions:  req.decisions ?? [],
            status:     req.status ?? inv.status,
          }
        })
        setOverrides(newOverrides)
      })
  }, [liveData])

  // Reset overrides when switching between mock and live
  useEffect(() => { setOverrides({}) }, [isConfigured])

  const getInvoice = (inv) => ({ ...inv, ...(overrides[inv.id] ?? {}) })
  const invoices = baseInvoices.map(getInvoice)

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const totalOutstanding = invoices
    .filter(i => !['paid', 'rejected'].includes(i.status))
    .reduce((s, i) => s + i.amount, 0)
  const dueThisWeek = invoices.filter(i => {
    if (!i.due) return false
    const days = (new Date(i.due) - new Date()) / 86_400_000
    return days >= 0 && days <= 7 && !['paid', 'rejected'].includes(i.status)
  }).length
  const overdue  = invoices.filter(i => i.status === 'overdue').length
  const pending  = invoices.filter(i => i.status === 'pending_approval').length

  const STATUSES = ['All', 'Draft', 'Pending Approval', 'Approved', 'Payment Queued', 'Paid', 'Overdue']

  const statusKey = (label) => ({
    'All': 'All', 'Draft': 'draft', 'Pending Approval': 'pending_approval',
    'Approved': 'approved', 'Payment Queued': 'queued', 'Paid': 'paid', 'Overdue': 'overdue',
  }[label])

  const filtered = invoices
    .filter(i => {
      if (statusFilter !== 'All' && i.status !== statusKey(statusFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return i.vendor.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
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

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(0)
  }

  // ── Approval actions ──────────────────────────────────────────────────────
  const handleApprove = (inv) => setModal({ type: 'approve', invoice: inv })
  const handleReject  = (inv) => setModal({ type: 'reject',  invoice: inv })

  const confirmAction = async (approverName, reason) => {
    const inv = modal.invoice
    const existing = overrides[inv.id] ?? {}
    const currentApprovedBy = existing.approvedBy ?? inv.approvedBy ?? []
    const currentDecisions  = existing.decisions  ?? inv.decisions  ?? []
    const now = new Date().toISOString()

    if (modal.type === 'approve') {
      if (currentApprovedBy.includes(approverName)) {
        throw new Error('This approver has already approved this invoice.')
      }
      const newApprovedBy = [...currentApprovedBy, approverName]
      const fullyApproved = newApprovedBy.length >= REQUIRED_APPROVALS
      const newStatus     = fullyApproved ? 'approved' : 'pending_approval'
      const newDecisions  = [
        ...currentDecisions.filter(d => d.decision === 'approved'),
        { approver_name: approverName, decision: 'approved', timestamp: now },
      ]

      setOverrides(prev => ({
        ...prev,
        [inv.id]: { approvedBy: newApprovedBy, decisions: newDecisions, status: newStatus },
      }))

      await saveApprovalRequest({
        invoiceRawId: inv.rawId ?? inv.id,
        decisions:    newDecisions,
        status:       newStatus,
        amountHint:   fmtAmt(inv.amount, inv.currency),
      })

    } else {
      // Reject
      const newDecisions = [
        ...currentDecisions.filter(d => d.decision === 'approved'),
        { approver_name: approverName, decision: 'rejected', timestamp: now, comment: reason },
      ]

      setOverrides(prev => ({
        ...prev,
        [inv.id]: { approvedBy: currentApprovedBy, decisions: newDecisions, status: 'rejected' },
      }))

      await saveApprovalRequest({
        invoiceRawId: inv.rawId ?? inv.id,
        decisions:    newDecisions,
        status:       'rejected',
        amountHint:   fmtAmt(inv.amount, inv.currency),
      })
    }

    setModal(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const columns = [
    { key: 'date',   label: 'Date',     sortable: true  },
    { key: 'id',     label: 'Invoice #', sortable: false },
    { key: 'vendor', label: 'Vendor',   sortable: true  },
    { key: 'amount', label: 'Amount',   sortable: true  },
    { key: 'due',    label: 'Due Date', sortable: true  },
    { key: 'status', label: 'Status',   sortable: false },
    { key: 'approvals', label: '4-Eyes', sortable: false },
    { key: 'actions',   label: '',      sortable: false },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar title="Accounts Payable" subtitle="AP Agent · Supplier invoices, 4-eyes approval, payment queue" />

      <main className="flex-1 px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Outstanding', value: fmtAmt(totalOutstanding), icon: FileText,      color: 'text-brand-600 bg-brand-50' },
            { label: 'Due This Week',     value: dueThisWeek,              icon: Clock,          color: 'text-amber-600 bg-amber-50' },
            { label: 'Overdue',           value: overdue,                   icon: AlertTriangle,  color: overdue > 0 ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50' },
            { label: 'Awaiting Approval', value: pending,                   icon: Users,          color: pending > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-50' },
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

        {/* Invoice table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 flex-wrap gap-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Supplier Invoices</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} invoices</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filters */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1 overflow-x-auto max-w-full">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(0) }}
                    className={clsx(
                      'px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                      statusFilter === s
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search vendor…"
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
                  {columns.map(col => (
                    <th key={col.key} className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {col.sortable ? (
                        <button className="flex items-center gap-1 hover:text-slate-600 transition-colors" onClick={() => handleSort(col.key)}>
                          {col.label}
                          <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                        <span className="text-xs">Loading invoices…</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && pageData.map(inv => {
                  const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.draft
                  const approvedBy    = inv.approvedBy ?? []
                  const approvedCount = approvedBy.length
                  const decisions     = inv.decisions ?? []
                  const isPending     = inv.status === 'pending_approval'
                  const daysUntilDue  = inv.due
                    ? Math.ceil((new Date(inv.due) - new Date()) / 86_400_000)
                    : null

                  // Find the rejector (if any)
                  const rejectorDecision = decisions.find(d => d.decision === 'rejected')

                  return (
                    <tr key={inv.id} className="group border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                      {/* Date */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{inv.date}</td>

                      {/* Invoice # */}
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-400 whitespace-nowrap">{inv.id}</td>

                      {/* Vendor */}
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 max-w-[180px]">
                        <span className="truncate block">{inv.vendor}</span>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                        {fmtAmt(inv.amount, inv.currency)}
                      </td>

                      {/* Due date */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={clsx(
                          'text-xs font-medium',
                          daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-600 font-bold'
                            : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-600 font-semibold'
                            : 'text-slate-500'
                        )}>
                          {inv.due ?? '—'}
                          {daysUntilDue !== null && daysUntilDue < 0 && (
                            <span className="ml-1 text-[10px]">({Math.abs(daysUntilDue)}d overdue)</span>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap',
                          cfg.bg, cfg.text
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* 4-eyes indicator */}
                      <td className="px-5 py-3.5">
                        {['pending_approval', 'approved', 'queued', 'paid'].includes(inv.status) ? (
                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: REQUIRED_APPROVALS }, (_, i) => (
                              <div
                                key={i}
                                className={clsx(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
                                  i < approvedCount
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-400'
                                )}
                                title={approvedBy[i] ?? 'Pending'}
                              >
                                {i < approvedCount ? '✓' : '·'}
                              </div>
                            ))}
                            <span className="text-[10px] text-slate-500 font-semibold ml-0.5">
                              {approvedCount}/{REQUIRED_APPROVALS}
                            </span>
                            {approvedBy.length > 0 && (
                              <span className="text-[10px] text-slate-400 ml-0.5 hidden xl:inline">
                                {approvedBy.join(', ')}
                              </span>
                            )}
                          </div>
                        ) : inv.status === 'rejected' && rejectorDecision ? (
                          <span className="text-[10px] text-red-500 font-medium" title={rejectorDecision.comment}>
                            Rejected by {rejectorDecision.approver_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        {isPending && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApprove(inv)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-200 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {approvedCount > 0 ? 'Approve (2nd)' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(inv)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-50 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!loading && pageData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                      No invoices match your filters.
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
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                  Prev
                </button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)}
                    className={clsx('w-7 h-7 rounded-xl text-xs font-semibold transition-colors',
                      i === page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200')}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page === pageCount - 1}
                  className="px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Approval modal */}
      {modal && (
        <ApprovalModal
          invoice={modal.invoice}
          type={modal.type}
          onConfirm={confirmAction}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
