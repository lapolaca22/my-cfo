import { useState } from 'react'
import { Zap, AlertCircle, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'

// Microsoft Windows logo — 4 coloured squares (official brand colours)
function MicrosoftLogo({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <path fill="#f25022" d="M0 0h10v10H0z" />
      <path fill="#00a4ef" d="M11 0h10v10H11z" />
      <path fill="#7fba00" d="M0 11h10v10H0z" />
      <path fill="#ffb900" d="M11 11h10v10H11z" />
    </svg>
  )
}

// Google logo — official multicolour G
function GoogleLogo({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function Login() {
  const { signInWithMicrosoft, signInWithGoogle, isDemo } = useAuth()
  const [loading, setLoading] = useState(null) // 'microsoft' | 'google' | null
  const [error,   setError]   = useState(null)

  const handleSignIn = async (provider) => {
    setError(null)
    setLoading(provider)
    try {
      if (provider === 'microsoft') await signInWithMicrosoft()
      else                          await signInWithGoogle()
      // Supabase redirects the browser — no further action needed here
    } catch (err) {
      setError(err.message ?? 'Sign-in failed. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      {/* Subtle grid pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #1e3a5f 1px, transparent 1px)',
          backgroundSize:  '28px 28px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-7">

          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">my-cfo</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Finance Automation Platform</p>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-800">Welcome back</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Sign in with your Microsoft account to access the CFO dashboard.
            </p>
          </div>

          {/* Demo mode notice */}
          {isDemo && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Demo mode</p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                  Supabase is not configured. You are auto-signed in as CFO. Configure{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> to enable real auth.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Sign-in buttons */}
          <div className="space-y-3">
            {/* Microsoft */}
            <button
              onClick={() => handleSignIn('microsoft')}
              disabled={loading !== null || isDemo}
              className={clsx(
                'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                'border border-slate-300 bg-white text-slate-700 text-sm font-semibold',
                'hover:bg-slate-50 active:bg-slate-100 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-1',
                (loading !== null || isDemo) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading === 'microsoft' ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  Redirecting to Microsoft…
                </>
              ) : (
                <>
                  <MicrosoftLogo size={20} />
                  Sign in with Microsoft
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[11px] text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Google */}
            <button
              onClick={() => handleSignIn('google')}
              disabled={loading !== null || isDemo}
              className={clsx(
                'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl',
                'border border-slate-300 bg-white text-slate-700 text-sm font-semibold',
                'hover:bg-slate-50 active:bg-slate-100 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-1',
                (loading !== null || isDemo) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading === 'google' ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <GoogleLogo size={20} />
                  Sign in with Google
                </>
              )}
            </button>

            {isDemo && (
              <p className="text-center text-[11px] text-slate-400">
                SSO disabled in demo mode — you are already signed in.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-slate-400 leading-relaxed">
          Access is restricted to authorised team members.
          <br />
          Contact your CFO to request access.
        </p>
      </div>
    </div>
  )
}
