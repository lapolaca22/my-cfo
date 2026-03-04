import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

/**
 * Fetch pending approval requests from Supabase.
 * Joins the related invoice to get vendor name and amount.
 */
export function useApprovals() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: rows, error: err } = await supabase
        .from('approval_requests')
        .select(`
          id,
          amount_hint,
          status,
          created_at,
          invoices (
            invoice_number,
            vendor_or_customer,
            amount,
            currency,
            due_date
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20)

      if (err) throw err

      // Normalise to a flat shape matching the PendingApprovals component
      const normalised = (rows ?? []).map(r => ({
        id:      r.id,
        vendor:  r.invoices?.vendor_or_customer ?? 'Unknown vendor',
        amount:  r.amount_hint ?? `${r.invoices?.currency ?? 'EUR'} ${Number(r.invoices?.amount ?? 0).toLocaleString()}`,
        due:     r.invoices?.due_date ?? '—',
        urgency: getUrgency(r.invoices?.due_date),
      }))
      setData(normalised)
    } catch (err) {
      console.error('[useApprovals]', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()

    if (!isConfigured) return
    const channel = supabase
      .channel('approvals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

function getUrgency(dueDateStr) {
  if (!dueDateStr) return 'low'
  const daysUntil = Math.ceil((new Date(dueDateStr) - new Date()) / 86_400_000)
  if (daysUntil <= 3) return 'high'
  if (daysUntil <= 7) return 'medium'
  return 'low'
}
