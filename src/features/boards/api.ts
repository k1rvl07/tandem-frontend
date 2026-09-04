import { http } from '@/api/http'
import type {
  Board,
  BoardDetail,
  Column,
  CreateBoardRequest,
  CreateColumnRequest,
  CreateTaskRequest,
  Task,
  UpdateBoardRequest,
  UpdateColumnRequest,
  UpdateTaskRequest,
} from '@/shared/types'

export async function listBoards(workspaceId: string): Promise<Board[]> {
  const res = await http.get<Board[]>(`/workspaces/${workspaceId}/boards`)
  return res.data
}

export async function createBoard(
  workspaceId: string,
  payload: CreateBoardRequest,
): Promise<Board> {
  const res = await http.post<Board>(`/workspaces/${workspaceId}/boards`, payload)
  return res.data
}

export async function getBoard(workspaceId: string, boardId: string): Promise<BoardDetail> {
  const res = await http.get<BoardDetail>(`/workspaces/${workspaceId}/boards/${boardId}`)
  return res.data
}

export async function updateBoard(
  workspaceId: string,
  boardId: string,
  payload: UpdateBoardRequest,
): Promise<Board> {
  const res = await http.patch<Board>(`/workspaces/${workspaceId}/boards/${boardId}`, payload)
  return res.data
}

export async function deleteBoard(workspaceId: string, boardId: string): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/boards/${boardId}`)
}

export async function createColumn(
  workspaceId: string,
  boardId: string,
  payload: CreateColumnRequest,
): Promise<Column> {
  const res = await http.post<Column>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns`,
    payload,
  )
  return res.data
}

export async function updateColumn(
  workspaceId: string,
  boardId: string,
  columnId: string,
  payload: UpdateColumnRequest,
): Promise<Column> {
  const res = await http.patch<Column>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`,
    payload,
  )
  return res.data
}

export async function deleteColumn(
  workspaceId: string,
  boardId: string,
  columnId: string,
): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`)
}

export async function createTask(
  workspaceId: string,
  boardId: string,
  payload: CreateTaskRequest,
): Promise<Task> {
  const res = await http.post<Task>(`/workspaces/${workspaceId}/boards/${boardId}/tasks`, payload)
  return res.data
}

export async function updateTask(
  workspaceId: string,
  boardId: string,
  taskId: string,
  payload: UpdateTaskRequest,
): Promise<Task> {
  const res = await http.patch<Task>(
    `/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`,
    payload,
  )
  return res.data
}

export async function deleteTask(
  workspaceId: string,
  boardId: string,
  taskId: string,
): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`)
}
