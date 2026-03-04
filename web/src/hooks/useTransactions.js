import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

/**
 * Fetch the unified_transactions view from Supabase.
 * Falls back to an empty array when Supabase is not configured.
 *
 * The view combines: AP invoices, AR invoices, bank payments, GL journal entries.
 */
export function useTransactions({ limit = 50 } = {}) {
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
        .from('unified_transactions')
        .select('*')
        .limit(limit)

      if (err) throw err

      // Normalise to the shape the TransactionsTable component expects
      const normalised = (rows ?? []).map(r => ({
        id:           r.id,
        date:         r.txn_date,
        type:         r.txn_type,
        counterparty: r.counterparty,
        description:  r.description,
        amount:       Number(r.amount),
        currency:     r.currency ?? 'EUR',
        status:       r.status,
        agent:        r.agent,
        invoice:      r.reference ?? '—',
      }))

      setData(normalised)
    } catch (err) {
      console.error('[useTransactions]', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetch()

    if (!isConfigured) return
    // Re-fetch when any of the source tables change
    const tables = ['invoices', 'payments', 'journal_entries']
    const channels = tables.map(table =>
      supabase
        .channel(`txn-changes-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, fetch)
        .subscribe()
    )
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
