import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

/**
 * Fetch journal entries from Supabase.
 * Falls back to empty array (caller uses mock) when unconfigured.
 */
export function useJournalEntries({ limit = 100 } = {}) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: rows, error: err } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(limit)
      if (err) throw err
      // Normalise to shape expected by AccountingClose
      const normalised = (rows ?? []).map(r => ({
        id:            r.id,
        date:          r.entry_date,
        type:          r.entry_type ?? 'GL',
        description:   r.description,
        debitAccount:  r.debit_account ?? '—',
        creditAccount: r.credit_account ?? '—',
        amount:        Number(r.amount ?? 0),
        currency:      r.currency ?? 'EUR',
        status:        r.status ?? 'posted',
      }))
      setData(normalised)
    } catch (err) {
      console.error('[useJournalEntries]', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetch()
    if (!isConfigured) return
    const channel = supabase
      .channel('journal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
