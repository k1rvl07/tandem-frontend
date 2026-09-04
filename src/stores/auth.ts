import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '@/features/auth/api'
import type { LoginRequest, RegisterRequest, User } from '@/shared/types'

const TOKEN_KEY = 'tandem_token'
const USER_KEY = 'tandem_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(readStoredUser())

  const isAuthenticated = computed(() => token.value !== null)

  async function register(payload: RegisterRequest): Promise<void> {
    await authApi.register(payload)
  }

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

  return { token, user, isAuthenticated, register, login, logout }
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
