import { http } from '@/api/http'
import type { CreateUserRequest, User } from '@/shared/types'

export async function createUser(payload: CreateUserRequest): Promise<User> {
  const res = await http.post<User>('/admin/users', payload)
  return res.data
}

export async function listUsers(): Promise<User[]> {
  const res = await http.get<User[]>('/admin/users')
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await http.delete(`/admin/users/${id}`)
}
