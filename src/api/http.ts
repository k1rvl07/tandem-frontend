import axios, { type AxiosError } from 'axios'

export const HTTP_ERROR_EVENT = 'tandem:http-error'

export const UNAUTHORIZED_EVENT = 'tandem:unauthorized'

export const http = axios.create({
  baseURL: '/api/v1',
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('tandem_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const url = String(error.config?.url ?? '')
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('tandem_token')
      localStorage.removeItem('tandem_user')
      if (!window.location.pathname.startsWith('/login')) {
        const redirect = window.location.pathname + window.location.search
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: redirect }))
      }
    } else if (status === 429) {
      const headers = error.response?.headers as Record<string, string> | undefined
      const retryAfter = headers?.['retry-after']
      const message = retryAfter
        ? `Too many requests — retry in ${retryAfter}s`
        : 'Too many requests — slow down'
      window.dispatchEvent(new CustomEvent(HTTP_ERROR_EVENT, { detail: message }))
    }
    return Promise.reject(error)
  },
)
