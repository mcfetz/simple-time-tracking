export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type ApiError = {
  status: number
  message: string
}

function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL as string | undefined
  return url?.replace(/\/$/, '') || 'http://localhost:8000'
}

let accessToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) return false
        const data = (await res.json()) as { token: { access_token: string } }
        setAccessToken(data.token.access_token)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

export async function apiFetch<T>(
  path: string,
  opts?: {
    method?: HttpMethod
    body?: unknown
    headers?: Record<string, string>
    retryOn401?: boolean
  },
): Promise<T> {
  const method = opts?.method ?? 'GET'
  const retryOn401 = opts?.retryOn401 ?? true

  const headers: Record<string, string> = {
    ...(opts?.headers ?? {}),
  }

  if (opts?.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  })

  if (res.status === 401 && retryOn401) {
    const ok = await attemptRefresh()
    if (ok) {
      return apiFetch<T>(path, { ...opts, retryOn401: false })
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: string }
      message = data.detail || message
    } catch {
    }
    throw { status: res.status, message } satisfies ApiError
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
