import { useCallback, useState, useEffect } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../supabase'

const PENDING_GOOGLE_LINK_KEY = 'planner-pending-google-link-token'

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

async function getCurrentUserWithIdentities(fallbackUser = null) {
  if (!supabase) return fallbackUser

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const currentUser = userData?.user || fallbackUser

  if (userError || !currentUser) {
    return fallbackUser
  }

  const { data: identitiesData } = await supabase.auth.getUserIdentities()
  const { data: links } = await supabase
    .from('account_links')
    .select('primary_user_id,linked_user_id,provider')
    .or(`primary_user_id.eq.${currentUser.id},linked_user_id.eq.${currentUser.id}`)

  const accountLinks = Array.isArray(links) ? links : []
  const primaryLink = accountLinks.find((link) => link.linked_user_id === currentUser.id)
  return {
    ...currentUser,
    account_links: accountLinks,
    identities: identitiesData?.identities || currentUser.identities || [],
    google_connected: accountLinks.some((link) => link.provider === 'google'),
    task_owner_id: primaryLink?.primary_user_id || currentUser.id,
  }
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

  const params = new URLSearchParams(window.location.search)
  if (params.get('force_browser_flow') === '1') return false

  const userAgent = window.navigator?.userAgent || ''
  const search = window.location.search || ''
  const hash = window.location.hash || ''
  return Boolean(
    window.Telegram?.WebApp?.initData ||
    search.includes('tgWebAppData=') ||
    hash.includes('tgWebAppData=') ||
    /Telegram/i.test(userAgent)
  )
}

function getExternalGoogleAuthUrl() {
  const url = new URL(`${window.location.origin}${window.location.pathname}`)
  url.search = window.location.search
  url.searchParams.set('external_google_auth', '1')
  url.searchParams.set('force_browser_flow', '1')
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('tgWebAppData')
  url.searchParams.delete('tgWebAppVersion')
  url.searchParams.delete('tgWebAppPlatform')
  url.searchParams.delete('tgWebAppThemeParams')
  url.hash = ''
  return url.toString()
}

function openExternalUrl(url) {
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url, { try_instant_view: false })
    return
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    window.location.href = url
  }
}

function openExternalGoogleAuth() {
  openExternalUrl(getExternalGoogleAuthUrl())
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}

async function redirectToGoogleIdentityLink(setError) {
  if (!supabase) {
    const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
    setError(message)
    return { error: new Error(message) }
  }

  const { data, error } = await withTimeout(
    supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}?google_linked=1`,
        queryParams: {
          prompt: 'select_account',
        },
        skipBrowserRedirect: true,
      },
    }),
    10_000,
    'Google connection timed out. Try again.'
  )

  if (error) {
    setError(error.message)
    return { error }
  }

  if (!data?.url) {
    const missingUrlError = new Error('Google connection URL was not returned by Supabase.')
    setError(missingUrlError.message)
    return { error: missingUrlError }
  }

  window.location.href = data.url
  return { error: null }
}

async function startGoogleAccountLink(linkToken, setError) {
  if (!supabase) {
    const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
    setError(message)
    return { error: new Error(message) }
  }

  if (!linkToken) {
    const message = 'Account link token is missing.'
    setError(message)
    return { error: new Error(message) }
  }

  localStorage.setItem(PENDING_GOOGLE_LINK_KEY, linkToken)

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}?complete_google_link=1`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    setError(error.message)
    return { error }
  }

  return { error: null }
}

async function completeGoogleAccountLink(session, setError) {
  const linkToken = localStorage.getItem(PENDING_GOOGLE_LINK_KEY)

  if (!linkToken || !session?.access_token) {
    const message = 'Account link session is missing.'
    setError(message)
    return { error: new Error(message) }
  }

  const response = await withTimeout(
    fetch('/api/account-link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ linkToken }),
    }),
    10_000,
    'Account linking timed out. Try again.'
  )
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(body?.error || 'Could not link Google account.')
    setError(error.message)
    return { error }
  }

  localStorage.removeItem(PENDING_GOOGLE_LINK_KEY)
  return { error: null, data: body }
}

function getTelegramGoogleLinkUrl(linkToken) {
  const url = new URL(`${window.location.origin}${window.location.pathname}`)
  url.searchParams.set('telegram_google_link', '1')
  url.searchParams.set('force_browser_flow', '1')
  url.searchParams.set('account_link_token', linkToken)
  url.hash = ''
  return url.toString()
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
      const params = new URLSearchParams(window.location.search)
      if (params.get('telegram_google_link') === '1') {
        const linkToken = params.get('account_link_token') || ''

        params.delete('telegram_google_link')
        params.delete('force_browser_flow')
        params.delete('account_link_token')
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
        window.history.replaceState({}, document.title, nextUrl)

        const { error: linkError } = await startGoogleAccountLink(linkToken, setError)
        if (linkError && isMounted) {
          setLoading(false)
          return
        }
        return
      }

      const redirectError = getAuthRedirectError()
      if (redirectError) {
        setError(decodeURIComponent(redirectError.replace(/\+/g, ' ')))
        cleanAuthRedirectUrl()
      }

      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const shouldCompleteGoogleLink = urlParams.get('complete_google_link') === '1'
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

      if (shouldCompleteGoogleLink && session) {
        const { error: linkError } = await completeGoogleAccountLink(session, setError)
        if (linkError) {
          setLoading(false)
          return
        }
      }

      const freshUser = session?.user
        ? await getCurrentUserWithIdentities(session.user)
        : null

      if (!isMounted) return

      setUser(freshUser ?? session?.user ?? null)
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
        if (!session?.user) {
          setUser(null)
          setLoading(false)
          return
        }

        getCurrentUserWithIdentities(session.user)
          .then((freshUser) => {
            if (!isMounted) return
            setUser(freshUser ?? session.user)
            setLoading(false)
          })
          .catch(() => {
            if (!isMounted) return
            setUser(session.user)
            setLoading(false)
          })
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

  const linkGoogleIdentity = useCallback(async () => {
    setError('')
    return redirectToGoogleIdentityLink(setError)
  }, [])

  const connectGoogleAccount = useCallback(async () => {
    setError('')

    if (!supabase) {
      const message = supabaseConfigError || 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
      setError(message)
      return { error: new Error(message) }
    }

    const initData = window.Telegram?.WebApp?.initData || ''

    if (!isTelegramWebView() || !initData) {
      return linkGoogleIdentity()
    }

    try {
      const response = await fetch('/api/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body?.error || 'Could not prepare Google connection.')
      }

      openExternalUrl(getTelegramGoogleLinkUrl(body.linkToken))
      return { error: null }
    } catch (error) {
      setError(error.message || 'Could not prepare Google connection.')
      return { error }
    }
  }, [linkGoogleIdentity])

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
    connectGoogleAccount,
    signOut,
  }
}
