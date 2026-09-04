import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/features/auth/api'
import * as profileApi from '@/features/profile/api'
import type {
  ChangePasswordRequest,
  LoginRequest,
  UpdateProfileRequest,
  User,
} from '@/shared/types'

const TOKEN_KEY = 'tandem_token'
const USER_KEY = 'tandem_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(readStoredUser())

  const isAuthenticated = computed(() => token.value !== null)

  async function login(payload: LoginRequest): Promise<void> {
    const res = await authApi.login(payload)
    token.value = res.token
    user.value = res.user
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
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

  async function changePassword(payload: ChangePasswordRequest): Promise<void> {
    await profileApi.changePassword(payload)
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    logout,
    fetchProfile,
    updateProfile,
    uploadAvatar,
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
