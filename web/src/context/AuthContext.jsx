/**
 * Azure AD OAuth — one-time setup:
 *
 * 1. Azure Portal → App registrations → New registration
 *    - Supported account types: "Accounts in this organizational directory only" (or multi-tenant)
 *    - Redirect URI (Web): https://<project-ref>.supabase.co/auth/v1/callback
 *
 * 2. After registration:
 *    - Note the Application (client) ID
 *    - Certificates & secrets → New client secret → note the Value
 *
 * 3. Supabase Dashboard → Authentication → Providers → Azure (Microsoft):
 *    - Paste Client ID and Client Secret
 *    - Azure Tenant: leave blank for multi-tenant, or enter your tenant ID
 *
 * 4. Supabase Dashboard → Authentication → URL Configuration:
 *    - Site URL: http://localhost:5173 (dev) or your production URL
 *    - Add Redirect URLs: http://localhost:5173/** and your production URL/**
 *
 * 5. No changes needed here — Supabase handles the OAuth callback automatically.
 */

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

// ── Mock user for demo mode (Supabase not configured) ─────────────────────────
const DEMO_USER = {
  id:             'demo-cfo-user',
  email:          'cfo@acmecorp.com',
  user_metadata:  { full_name: 'CFO User' },
}
const DEMO_PROFILE = { name: 'CFO User', role: 'cfo', status: 'active' }

// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null) // { name, role, status } from app_users
  const [loading, setLoading] = useState(true)

  // Fetch role + name from app_users for the signed-in email
  const fetchProfile = async (email) => {
    const { data } = await supabase
      .from('app_users')
      .select('name, role, status')
      .eq('email', email)
      .maybeSingle()

    // Fallback: unknown user → cfo until roles are configured
    setProfile(data ?? { name: email, role: 'cfo', status: 'active' })
  }

  useEffect(() => {
    // Demo mode — skip real auth, auto-login as CFO
    if (!isConfigured) {
      setUser(DEMO_USER)
      setProfile(DEMO_PROFILE)
      setLoading(false)
      return
    }

    // Safety timeout: if INITIAL_SESSION never fires (stale session lock,
    // network error, etc.) force loading=false after 3 s so the app doesn't
    // hang — RequireAuth will then redirect to /login.
    let initialSessionReceived = false
    const timeoutId = setTimeout(() => {
      if (!initialSessionReceived) {
        setLoading(false)
      }
    }, 3000)

    // Supabase v2 recommended pattern: use onAuthStateChange exclusively.
    // INITIAL_SESSION is the first event fired (synchronously with restored/OAuth
    // session from localStorage or URL hash). This avoids a race between
    // getSession() and subsequent SIGNED_IN events after an OAuth redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null
        setUser(u)

        if (u) {
          // Read role from app_users by email; default to cfo if not found
          await fetchProfile(u.email)
        } else {
          setProfile(null)
        }

        // Resolve the initial loading state after the first event
        if (event === 'INITIAL_SESSION') {
          initialSessionReceived = true
          clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithMicrosoft = () =>
    supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes:     'openid email profile',
        redirectTo: `${window.location.origin}/`,
      },
    })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:     'openid email profile',
        redirectTo: `${window.location.origin}/`,
      },
    })

  const signOut = () => supabase.auth.signOut()

  // Derived helpers
  const role        = profile?.role ?? 'read_only'
  const displayName = profile?.name
    ?? user?.user_metadata?.full_name
    ?? user?.email
    ?? 'User'
  const avatarInitials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <AuthContext.Provider value={{
      user,
      role,
      displayName,
      avatarInitials,
      loading,
      isDemo: !isConfigured,
      signInWithMicrosoft,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>')
  return ctx
}
