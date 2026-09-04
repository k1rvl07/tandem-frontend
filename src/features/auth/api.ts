import { http } from '@/api/http'
import type { LoginRequest, LoginResponse } from '@/shared/types'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', payload)
  return res.data
}
