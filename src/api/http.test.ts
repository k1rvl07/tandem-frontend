import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authHttp, http, TOKENS_REFRESHED_EVENT, UNAUTHORIZED_EVENT } from './http'

const originalHttpAdapter = http.defaults.adapter
const originalAuthAdapter = authHttp.defaults.adapter

type Call = {
  url: string
  authorization: string | undefined
  body: string
}

let dataCalls: Call[] = []
let refreshCalls: Call[] = []
let dataFailures = 0
let refreshStatus = 200

function recordCall(call: Call[], config: InternalAxiosRequestConfig): void {
  call.push({
    url: config.url ?? '',
    authorization: (config.headers as AxiosHeaders | undefined)?.get('Authorization') as
      | string
      | undefined,
    body: typeof config.data === 'string' ? config.data : JSON.stringify(config.data),
  })
}

function unauthorizedResponse(config: InternalAxiosRequestConfig): Promise<AxiosResponse<unknown>> {
  return Promise.reject(
    new AxiosError<{ error: string }>(
      'Unauthorized',
      AxiosError.ERR_BAD_REQUEST,
      config,
      undefined,
      {
        data: { error: 'invalid credentials' },
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config,
        request: {},
      } as never,
    ),
  )
}

function successResponse(
  data: unknown,
  config: InternalAxiosRequestConfig,
): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
    request: {},
  } as AxiosResponse
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('tandem_refresh', 'rt-1')
  dataCalls = []
  refreshCalls = []
  dataFailures = 0
  refreshStatus = 200

  http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    recordCall(dataCalls, config)
    if (dataFailures > 0) {
      dataFailures -= 1
      return unauthorizedResponse(config)
    }
    return successResponse({ ok: true }, config)
  }
  authHttp.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    recordCall(refreshCalls, config)
    if (refreshStatus === 401) {
      return unauthorizedResponse(config)
    }
    return successResponse({ token: 'fresh', refresh_token: 'rt-2' }, config)
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  http.defaults.adapter = originalHttpAdapter
  authHttp.defaults.adapter = originalAuthAdapter
})

describe('http silent refresh', () => {
  it('refreshes tokens once and retries the failed request', async () => {
    const onRefreshed = vi.fn()
    const onUnauthorized = vi.fn()
    window.addEventListener(TOKENS_REFRESHED_EVENT, onRefreshed)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)

    dataFailures = 1
    localStorage.setItem('tandem_token', 'old')

    const res = await http.get('/me')

    expect(res.status).toBe(200)
    expect(dataCalls).toHaveLength(2)
    expect(dataCalls[0].authorization).toBe('Bearer old')
    expect(dataCalls[1].authorization).toBe('Bearer fresh')
    expect(refreshCalls).toHaveLength(1)
    expect(refreshCalls[0].body).toContain('rt-1')
    expect(localStorage.getItem('tandem_token')).toBe('fresh')
    expect(localStorage.getItem('tandem_refresh')).toBe('rt-2')
    expect(onRefreshed).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).not.toHaveBeenCalled()

    window.removeEventListener(TOKENS_REFRESHED_EVENT, onRefreshed)
    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  })

  it('clears the session when refresh fails', async () => {
    const onUnauthorized = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)

    dataFailures = 1
    refreshStatus = 401
    localStorage.setItem('tandem_token', 'old')
    localStorage.setItem('tandem_user', JSON.stringify({ id: 'u1' }))

    await expect(http.get('/me')).rejects.toThrow()

    expect(localStorage.getItem('tandem_token')).toBeNull()
    expect(localStorage.getItem('tandem_refresh')).toBeNull()
    expect(localStorage.getItem('tandem_user')).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(dataCalls).toHaveLength(1)
    expect(refreshCalls).toHaveLength(1)

    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  })

  it('deduplicates concurrent refreshes', async () => {
    dataFailures = 2
    localStorage.setItem('tandem_token', 'old')

    const [a, b] = await Promise.all([http.get('/me'), http.get('/profile')])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(refreshCalls).toHaveLength(1)
    expect(dataCalls).toHaveLength(4)
    expect(localStorage.getItem('tandem_token')).toBe('fresh')
    expect(dataCalls.slice(2).map((c) => c.authorization)).toEqual(['Bearer fresh', 'Bearer fresh'])
  })

  it('does not refresh on login failure', async () => {
    dataFailures = 1
    await expect(http.post('/auth/login', { login: 'x', password: 'y' })).rejects.toThrow()
    expect(refreshCalls).toHaveLength(0)
    expect(localStorage.getItem('tandem_token')).toBeNull()
  })
})
