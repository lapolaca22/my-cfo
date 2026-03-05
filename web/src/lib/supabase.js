import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn(
    '[my-cfo] Supabase env vars not set. ' +
    'Copy web/.env.example to web/.env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
    'The dashboard will fall back to mock data until credentials are provided.'
  )
}

/**
 * Supabase browser client — uses the anon key (respects RLS).
 * Export a single instance and reuse it across hooks.
 */
export const supabase = (url && key)
  ? createClient(url, key, {
      auth: {
        persistSession: true,       // required: keeps session alive across OAuth redirect
        storageKey:     'my-cfo',
      },
    })
  : null

/** True when Supabase is properly configured. */
export const isConfigured = Boolean(url && key)
