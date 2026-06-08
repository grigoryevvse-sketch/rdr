import { useCallback, useState, useEffect } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../supabase'

function getAuthRedirectError() {
  const params = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    params.get('error_description') ||
    hashParams.get('error_description') ||
    params.get('error') ||
    hashParams.get('error') ||
    ''
  )
}

function cleanAuthRedirectUrl() {
  const hasAuthParams = (
    window.location.search.includes('code=') ||
    window.location.search.includes('error=') ||
    window.location.hash.includes('access_token=') ||
    window.location.hash.includes('error=')
  )

  if (hasAuthParams) {
    window.history.replaceState({}, document.title, window.location.pathname)
  }
}

export function isTelegramWebView() {
  if (typeof window === 'undefined') return false

  const userAgent = window.navigator?.userAgent || ''
  return Boolean(window.Telegram?.WebApp || /Telegram/i.test(userAgent))
}

function getExternalGoogleAuthUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('external_google_auth', '1')
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.hash = ''
  return url.toString()
}

function openExternalGoogleAuth() {
  const authUrl = getExternalGoogleAuthUrl()

  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(authUrl, { try_instant_view: false })
    return
  }

  const opened = window.open(authUrl, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.href = authUrl
  }
}

/**
 * Hook to manage Supabase auth state.
 * Returns: { user, loading, error, isConfigured, signInWithGoogle, signOut }
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabaseConfigError)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    async function loadSession() {
      const redirectError = getAuthRedirectError()
      if (redirectError) {
        setError(decodeURIComponent(redirectError.replace(/\+/g, ' ')))
        cleanAuthRedirectUrl()
      }

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        cleanAuthRedirectUrl()

        if (exchangeError) {
          setError(exchangeError.message)
        }
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (!isMounted) return

      if (sessionError) {
        setError(sessionError.message)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }

    loadSession().catch((sessionError) => {
      if (isMounted) {
        if (sessionError) {
          setError(sessionError.message || 'Could not complete Google sign-in.')
        }
        setLoading(false)
      }
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setError('')
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async ({ forceOAuth = false } = {}) => {
    setError('')
    if (!supabase) {
      const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
      setError(message)
      return { error: new Error(message) }
    }

    if (!forceOAuth && isTelegramWebView()) {
      openExternalGoogleAuth()
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })

    if (error) {
      setError(error.message)
      return { error }
    }

    return { error: null }
  }, [])

  const signInWithTelegram = useCallback(async () => {
    setError('')

    if (!supabase) {
      const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
      setError(message)
      return { error: new Error(message) }
    }

    const initData = window.Telegram?.WebApp?.initData || ''

    if (!initData) {
      const message = 'Telegram login is available only inside Telegram.'
      setError(message)
      return { error: new Error(message) }
    }

    try {
      const response = await fetch('/api/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body?.error || 'Could not sign in with Telegram.')
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: body.tokenHash,
        type: body.verificationType || 'magiclink',
      })

      if (verifyError) {
        throw verifyError
      }

      return { error: null }
    } catch (error) {
      setError(error.message || 'Could not sign in with Telegram.')
      return { error }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setError('')
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    signInWithGoogle,
    signInWithTelegram,
    signOut,
  }
}
