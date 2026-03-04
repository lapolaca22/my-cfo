import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

/**
 * Fetch invoices from Supabase with optional filters.
 *
 * @param {Object} opts
 * @param {'supplier'|'customer'|null} opts.type   - filter by invoice_type
 * @param {string[]|null}              opts.statuses - filter by status IN list
 * @param {number}                     opts.limit
 */
export function useInvoices({ type = null, statuses = null, limit = 100 } = {}) {
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
      let query = supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
        .limit(limit)

      if (type)     query = query.eq('invoice_type', type)
      if (statuses) query = query.in('status', statuses)

      const { data: rows, error: err } = await query
      if (err) throw err
      setData(rows ?? [])
    } catch (err) {
      console.error('[useInvoices]', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [type, JSON.stringify(statuses), limit])

  useEffect(() => {
    fetch()

    // Real-time subscription: re-fetch on any invoices change
    if (!isConfigured) return
    const channel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
