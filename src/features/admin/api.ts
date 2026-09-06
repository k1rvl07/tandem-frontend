import { http } from '@/api/http'
import type { CreateUserRequest, User, UserRole } from '@/shared/types'

export interface AdminPage {
  items: User[]
  total: number
  page: number
  page_size: number
}

export async function createUser(payload: CreateUserRequest): Promise<User> {
  const res = await http.post<User>('/admin/users', payload)
  return res.data
}

export async function listUsers(page = 1, pageSize = 20, q = ''): Promise<AdminPage> {
  const res = await http.get<AdminPage>('/admin/users', {
    params: { page, page_size: pageSize, q },
  })
  return res.data
}

export async function updateUserRole(id: string, role: UserRole): Promise<User> {
  const res = await http.patch<User>(`/admin/users/${id}/role`, { role })
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await http.delete(`/admin/users/${id}`)
}
