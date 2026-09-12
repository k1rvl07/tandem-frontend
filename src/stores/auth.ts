import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { TOKENS_REFRESHED_EVENT } from '@/api/http'
import * as authApi from '@/features/auth/api'
import * as profileApi from '@/features/profile/api'
import type {
  ChangePasswordRequest,
  LoginRequest,
  TokenPair,
  UpdateProfileRequest,
  User,
} from '@/shared/types'
import { isTokenUsable } from '@/shared/utils/jwt'

const TOKEN_KEY = 'tandem_token'
const REFRESH_KEY = 'tandem_refresh'
const USER_KEY = 'tandem_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY))
  const user = ref<User | null>(readStoredUser())

  const isAuthenticated = computed(() => token.value !== null && isTokenUsable(token.value))

  function applyTokens(next: TokenPair): void {
    token.value = next.token
    refreshToken.value = next.refresh_token
    localStorage.setItem(TOKEN_KEY, next.token)
    localStorage.setItem(REFRESH_KEY, next.refresh_token)
  }

  function onTokensRefreshed(event: Event): void {
    const next = (event as CustomEvent<TokenPair>).detail
    if (next?.token) {
      applyTokens(next)
    }
  }

  window.addEventListener(TOKENS_REFRESHED_EVENT, onTokensRefreshed)

  async function login(payload: LoginRequest): Promise<void> {
    const res = await authApi.login(payload)
    applyTokens(res)
    user.value = res.user
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
  }

  function clearSession(): void {
    token.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  }

  function logout(): void {
    authApi.logout().catch(() => undefined)
    clearSession()
  }

  function setUser(updated: User): void {
    user.value = updated
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
  }

  async function fetchProfile(): Promise<User> {
    const profile = await profileApi.getProfile()
    setUser(profile)
    return profile
  }

  async function updateProfile(payload: UpdateProfileRequest): Promise<User> {
    const profile = await profileApi.updateProfile(payload)
    setUser(profile)
    return profile
  }

  async function uploadAvatar(file: File): Promise<User> {
    const profile = await profileApi.uploadAvatar(file)
    setUser(profile)
    return profile
  }

  async function removeAvatar(): Promise<User> {
    const profile = await profileApi.removeAvatar()
    setUser(profile)
    return profile
  }

  async function changePassword(payload: ChangePasswordRequest): Promise<void> {
    const next = await profileApi.changePassword(payload)
    applyTokens(next)
  }

  return {
    token,
    refreshToken,
    user,
    isAuthenticated,
    login,
    logout,
    clearSession,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    changePassword,
  }
})

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}
