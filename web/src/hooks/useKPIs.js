import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { kpiData as mockKPIs, sparklines as mockSparklines } from '../data/mockData'

/**
 * Compute CFO KPI data from Supabase tables.
 *
 * Returns data in the exact same shape as kpiData in mockData.js so that
 * KPICard components need no changes.
 *
 * Falls back gracefully to mock data when Supabase is not configured.
 */
export function useKPIs() {
  const [kpis, setKpis]           = useState(mockKPIs)
  const [sparklines, setSparklines] = useState(mockSparklines)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const fetch = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return  // stays on mock data
    }
    setLoading(true)
    try {
      // Fetch both KPI views in parallel
      const [apRes, arRes, reportsRes] = await Promise.all([
        supabase.from('ap_kpi').select('*').single(),
        supabase.from('ar_kpi').select('*').single(),
        supabase
          .from('cfo_reports')
          .select('financial_snapshot, ap_summary, ar_summary')
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const ap  = apRes.data  ?? {}
      const ar  = arRes.data  ?? {}
      const rpt = reportsRes.data ?? {}
      const snap = rpt.financial_snapshot ?? {}

      const fmt = (n) => {
        const num = Number(n ?? 0)
        if (num >= 1_000_000) return `€ ${(num / 1_000_000).toFixed(2)}M`
        if (num >= 1_000)     return `€ ${Math.round(num / 1_000)}k`
        return `€ ${Math.round(num).toLocaleString()}`
      }

      const apTotal   = Number(ap.total_outstanding   ?? 0)
      const arTotal   = Number(ar.total_outstanding   ?? 0)
      const cashSnap  = snap.cash_inflows != null
        ? (Number(snap.cash_inflows) - Number(snap.cash_outflows))
        : null
      const netIncome = snap.net_income != null ? Number(snap.net_income) : null

      const computed = [
        {
          ...mockKPIs[0],
          value:    fmt(apTotal),
          subValue: `${ap.total_invoices ?? 0} invoices`,
          detail: [
            { label: 'Due this week',       value: fmt(ap.due_this_week),        alert: false },
            { label: 'Overdue',             value: `${ap.overdue_count ?? 0} invoices`, alert: (ap.overdue_count ?? 0) > 0 },
            { label: 'Awaiting approval',   value: `${ap.pending_approval_count ?? 0} invoices` },
          ],
        },
        {
          ...mockKPIs[1],
          value:    fmt(arTotal),
          subValue: `${ar.total_invoices ?? 0} invoices`,
          detail: [
            { label: '0–30 days',  value: fmt(ar.current_bucket) },
            { label: '31–60 days', value: fmt(ar.aged_30_60) },
            { label: '61+ days',   value: fmt(ar.aged_60_plus), alert: Number(ar.aged_60_plus ?? 0) > 0 },
          ],
        },
        {
          ...mockKPIs[2],
          value:    cashSnap != null ? fmt(cashSnap) : mockKPIs[2].value,
          subValue: snap.period ? `Net cash · ${snap.period}` : mockKPIs[2].subValue,
        },
        {
          ...mockKPIs[3],
          value:    netIncome != null ? fmt(netIncome) : mockKPIs[3].value,
          subValue: snap.period ? `Net income · ${snap.period}` : mockKPIs[3].subValue,
          detail: [
            { label: 'Revenue', value: fmt(snap.revenue) },
            { label: 'Expenses', value: fmt(snap.expenses) },
            { label: 'Net', value: fmt(snap.net_income) },
          ],
        },
      ]

      setKpis(computed)
    } catch (err) {
      console.error('[useKPIs]', err)
      setError(err)
      // keep mock data on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()

    if (!isConfigured) return
    const tables = ['invoices', 'cfo_reports']
    const channels = tables.map(table =>
      supabase
        .channel(`kpi-changes-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, fetch)
        .subscribe()
    )
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [fetch])

  return { kpis, sparklines, loading, error, refetch: fetch }
}
