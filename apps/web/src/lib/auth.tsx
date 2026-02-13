import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, resetAuthExpiredSignal, setAccessToken } from './api'
import type { Lang } from './i18n'
import type { AuthResponse } from './types'

const USER_CACHE_KEY = 'tt_user_cache_v1'
const LANG_KEY = 'stt_lang_v1'

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthResponse['user'] }

type AuthContextValue = {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  function markExpiredAndLogout() {
    const lang = (localStorage.getItem(LANG_KEY) as Lang | null) || 'en'
    sessionStorage.setItem(
      'tt_flash',
      lang === 'de' ? 'Session abgelaufen. Bitte erneut anmelden.' : 'Session expired. Please sign in again.',
    )
    localStorage.removeItem(USER_CACHE_KEY)
    setAccessToken(null)
    setState({ status: 'anonymous' })
  }

  async function refresh() {
    try {
      const data = await apiFetch<AuthResponse>('/auth/refresh', { method: 'POST', retryOn401: false })
      resetAuthExpiredSignal()
      setAccessToken(data.token.access_token)
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user))
      setState({ status: 'authenticated', user: data.user })
    } catch (e) {
      if ((e as { status?: number })?.status === 401) {
        markExpiredAndLogout()
        return
      }
      const cached = localStorage.getItem(USER_CACHE_KEY)
      if (cached) {
        try {
          const user = JSON.parse(cached) as AuthResponse['user']
          setState({ status: 'authenticated', user })
          return
        } catch {
          localStorage.removeItem(USER_CACHE_KEY)
        }
      }

      setAccessToken(null)
      setState({ status: 'anonymous' })
    }
  }

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, retryOn401: false })
    resetAuthExpiredSignal()
    setAccessToken(data.token.access_token)
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user))
    setState({ status: 'authenticated', user: data.user })
  }

  async function register(email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { email, password }, retryOn401: false })
    resetAuthExpiredSignal()
    setAccessToken(data.token.access_token)
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user))
    setState({ status: 'authenticated', user: data.user })
  }

  async function logout() {
    try {
      await apiFetch<void>('/auth/logout', { method: 'POST', retryOn401: false })
    } finally {
      localStorage.removeItem(USER_CACHE_KEY)
      setAccessToken(null)
      setState({ status: 'anonymous' })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const onExpired = () => {
      markExpiredAndLogout()
    }
    window.addEventListener('tt:auth-expired', onExpired)
    return () => window.removeEventListener('tt:auth-expired', onExpired)
  }, [])

  useEffect(() => {
    const onOnline = () => {
      refresh().catch(() => undefined)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout, refresh }),
    [state],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}
