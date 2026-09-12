import { http } from '@/api/http'
import type { LoginRequest, LoginResponse, RefreshResponse } from '@/shared/types'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', payload)
  return res.data
}

export async function refresh(payload: { refresh_token: string }): Promise<RefreshResponse> {
  const res = await http.post<RefreshResponse>('/auth/refresh', payload)
  return res.data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
