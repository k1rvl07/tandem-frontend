import { http } from '@/api/http'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '@/shared/types'

export async function register(payload: RegisterRequest): Promise<User> {
  const res = await http.post<User>('/auth/register', payload)
  return res.data
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', payload)
  return res.data
}
