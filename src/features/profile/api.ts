import { http } from '@/api/http'
import type { ChangePasswordRequest, UpdateProfileRequest, User } from '@/shared/types'

export async function getProfile(): Promise<User> {
  const res = await http.get<User>('/me')
  return res.data
}

export async function updateProfile(payload: UpdateProfileRequest): Promise<User> {
  const res = await http.patch<User>('/me', payload)
  return res.data
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  const res = await http.post<User>('/me/avatar', form)
  return res.data
}

export async function removeAvatar(): Promise<User> {
  const res = await http.delete<User>('/me/avatar')
  return res.data
}

export async function changePassword(payload: ChangePasswordRequest): Promise<string> {
  const res = await http.post<{ token: string }>('/me/password', payload)
  return res.data.token
}
