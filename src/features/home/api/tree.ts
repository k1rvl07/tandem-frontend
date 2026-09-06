import { http } from '@/api/http'
import type { TaskTreeQuery, TreeWorkspace } from '@/shared/types'

export async function getTaskTree(query: TaskTreeQuery = {}): Promise<TreeWorkspace[]> {
  const params = new URLSearchParams()
  if (query.tasks) params.set('tasks', query.tasks)
  if (query.boards) params.set('boards', query.boards)
  if (query.workspaces) params.set('workspaces', query.workspaces)
  const res = await http.get<TreeWorkspace[]>('/tasks/tree', { params })
  return res.data
}
