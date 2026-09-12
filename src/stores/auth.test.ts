import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/shared/types'
import { useAuthStore } from './auth'

const apiMocks = vi.hoisted(() => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
  },
  profile: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    changePassword: vi.fn(),
  },
}))

vi.mock('@/features/auth/api', () => apiMocks.auth)
vi.mock('@/features/profile/api', () => apiMocks.profile)

const TOKEN_KEY = 'tandem_token'
const REFRESH_KEY = 'tandem_refresh'
const USER_KEY = 'tandem_user'

function b64url(payload: string): string {
  const padded = payload.length % 3 === 0 ? payload : payload + ' '.repeat(3 - (payload.length % 3))
  return btoa(padded).replace(/\+/g, '-').replace(/\//g, '_')
}

function validToken(): string {
  const claims = { iss: 'tandem', aud: 'tandem', exp: Math.floor(Date.now() / 1000) + 3600 }
  return `h.${b64url(JSON.stringify(claims))}.s`
}

const user: User = {
  id: 'u1',
  login: 'ivanov.ii',
  role: 'user',
  display_name: 'Ivan',
  bio: '',
  avatar_key: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('useAuthStore', () => {
  it('signs in and persists token and refresh token', async () => {
    apiMocks.auth.login.mockResolvedValueOnce({ token: validToken(), refresh_token: 'rt-1', user })
    const store = useAuthStore()

    await store.login({ login: 'ivanov.ii', password: 'secret' })

    expect(store.token).toBe(validToken())
    expect(store.refreshToken).toBe('rt-1')
    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem(TOKEN_KEY)).toBe(validToken())
    expect(localStorage.getItem(REFRESH_KEY)).toBe('rt-1')
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(user))
  })

  it('clearSession removes all session state', () => {
    localStorage.setItem(TOKEN_KEY, validToken())
    localStorage.setItem(REFRESH_KEY, 'rt-1')
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    const store = useAuthStore()

    store.clearSession()

    expect(store.token).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
  })

  it('logout clears the session and notifies the api', () => {
    apiMocks.auth.logout.mockResolvedValueOnce(undefined)
    localStorage.setItem(TOKEN_KEY, validToken())
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    const store = useAuthStore()

    store.logout()

    expect(apiMocks.auth.logout).toHaveBeenCalledTimes(1)
    expect(store.token).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('isAuthenticated is false for unusable tokens', () => {
    localStorage.setItem(TOKEN_KEY, 'malformed')
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('restores user from localStorage at startup', () => {
    localStorage.setItem(TOKEN_KEY, validToken())
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    const store = useAuthStore()
    expect(store.user).toEqual(user)
  })

  it('fetchProfile updates the stored user', async () => {
    const updated = { ...user, display_name: 'Ivanov II' }
    apiMocks.profile.getProfile.mockResolvedValueOnce(updated)
    localStorage.setItem(TOKEN_KEY, validToken())
    const store = useAuthStore()

    await store.fetchProfile()

    expect(store.user).toEqual(updated)
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(updated))
  })

  it('updateProfile updates the stored user', async () => {
    const updated = { ...user, bio: 'lead' }
    apiMocks.profile.updateProfile.mockResolvedValueOnce(updated)
    const store = useAuthStore()

    await store.updateProfile({ display_name: user.display_name, bio: 'lead' })

    expect(store.user).toEqual(updated)
  })

  it('changePassword rotates token and refresh token', async () => {
    const next = validToken()
    apiMocks.profile.changePassword.mockResolvedValueOnce({ token: next, refresh_token: 'rt-2' })
    localStorage.setItem(REFRESH_KEY, 'rt-1')
    const store = useAuthStore()

    await store.changePassword({ current_password: 'old', new_password: 'new-new-new' })

    expect(store.token).toBe(next)
    expect(store.refreshToken).toBe('rt-2')
    expect(localStorage.getItem(TOKEN_KEY)).toBe(next)
    expect(localStorage.getItem(REFRESH_KEY)).toBe('rt-2')
  })

  it('applies tokens refreshed in background', () => {
    const next = validToken()
    localStorage.setItem(TOKEN_KEY, next)
    localStorage.setItem(REFRESH_KEY, 'rt-1')
    const store = useAuthStore()

    window.dispatchEvent(
      new CustomEvent('tandem:tokens-refreshed', {
        detail: { token: next, refresh_token: 'rt-3' },
      }),
    )

    expect(store.token).toBe(next)
    expect(store.refreshToken).toBe('rt-3')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('rt-3')
  })

  it('removeAvatar clears avatar_key in the stored user', async () => {
    const cleared = { ...user, avatar_key: '' }
    apiMocks.profile.removeAvatar.mockResolvedValueOnce(cleared)
    const store = useAuthStore()

    await store.removeAvatar()

    expect(apiMocks.profile.removeAvatar).toHaveBeenCalledTimes(1)
    expect(store.user).toEqual(cleared)
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(cleared))
  })
})
