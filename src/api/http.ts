import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { RefreshResponse } from '@/shared/types'
import { isTokenUsable } from '@/shared/utils/jwt'

export const HTTP_ERROR_EVENT = 'tandem:http-error'

export const UNAUTHORIZED_EVENT = 'tandem:unauthorized'

export const TOKENS_REFRESHED_EVENT = 'tandem:tokens-refreshed'

const TOKEN_KEY = 'tandem_token'
const REFRESH_KEY = 'tandem_refresh'

export const http = axios.create({
  baseURL: '/api/v1',
})

export const authHttp = axios.create({
  baseURL: '/api/v1',
})

let refreshPromise: Promise<string | null> | null = null

export function savePair(token: string, refreshToken?: string | null): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken)
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refreshTokens(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) {
    return null
  }
  try {
    const res = await authHttp.post<RefreshResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    savePair(res.data.token, res.data.refresh_token)
    window.dispatchEvent(new CustomEvent(TOKENS_REFRESHED_EVENT, { detail: res.data }))
    return res.data.token
  } catch {
    return null
  }
}

function requestRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export function ensureFreshToken(): Promise<string | null> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && isTokenUsable(token)) {
    return Promise.resolve(token)
  }
  return requestRefresh()
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const url = String(error.config?.url ?? '')
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined

    if (status === 429) {
      const headers = error.response?.headers as Record<string, string> | undefined
      const retryAfter = headers?.['retry-after']
      const message = retryAfter
        ? `Too many requests — retry in ${retryAfter}s`
        : 'Too many requests — slow down'
      window.dispatchEvent(new CustomEvent(HTTP_ERROR_EVENT, { detail: message }))
      return Promise.reject(error)
    }

    if (status === 401 && url.includes('/auth/login')) {
      return Promise.reject(error)
    }

    if (status === 401 && config && !config._retried) {
      const fresh = await requestRefresh()
      if (fresh) {
        config.headers.Authorization = `Bearer ${fresh}`
        config._retried = true
        return http.request(config)
      }
    }

    if (status === 401) {
      clearTokens()
      localStorage.removeItem('tandem_user')
      if (!window.location.pathname.startsWith('/login')) {
        const redirect = window.location.pathname + window.location.search
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: redirect }))
      }
    }

    return Promise.reject(error)
  },
)
