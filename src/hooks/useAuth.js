import { useState, useEffect } from 'react'
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

  const signInWithGoogle = async () => {
    setError('')
    if (!supabase) {
      const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
      setError(message)
      return { error: new Error(message) }
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
  }

  const signOut = async () => {
    if (!supabase) return
    setError('')
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, error, isConfigured: isSupabaseConfigured, signInWithGoogle, signOut }
}
