import { http } from '@/api/http'
import type {
  Board,
  BoardDetail,
  CreateBoardRequest,
  CreateTaskRequest,
  ReorderBoardsRequest,
  Task,
  TaskAttachment,
  TaskDetail,
  UpdateBoardRequest,
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

export async function setMainBoard(workspaceId: string, boardId: string): Promise<Board> {
  const res = await http.put<Board>(`/workspaces/${workspaceId}/boards/${boardId}/main`)
  return res.data
}

export async function addBoardFavorite(boardId: string): Promise<void> {
  await http.put(`/favorites/boards/${boardId}`)
}

export async function removeBoardFavorite(boardId: string): Promise<void> {
  await http.delete(`/favorites/boards/${boardId}`)
}

export async function reorderBoards(
  workspaceId: string,
  payload: ReorderBoardsRequest,
): Promise<Board[]> {
  const res = await http.put<Board[]>(`/workspaces/${workspaceId}/boards/reorder`, payload)
  return res.data
}

export async function deleteBoard(workspaceId: string, boardId: string): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/boards/${boardId}`)
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

export async function getTaskDetail(workspaceId: string, taskId: string): Promise<TaskDetail> {
  const res = await http.get<TaskDetail>(`/workspaces/${workspaceId}/tasks/${taskId}`)
  return res.data
}

export async function listWorkspaceTasks(workspaceId: string): Promise<Task[]> {
  const res = await http.get<Task[]>(`/workspaces/${workspaceId}/tasks`)
  return res.data
}

export async function listAttachments(
  workspaceId: string,
  taskId: string,
): Promise<TaskAttachment[]> {
  const res = await http.get<TaskAttachment[]>(
    `/workspaces/${workspaceId}/tasks/${taskId}/attachments`,
  )
  return res.data
}

export async function createAttachment(
  workspaceId: string,
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await http.post<TaskAttachment>(
    `/workspaces/${workspaceId}/tasks/${taskId}/attachments`,
    formData,
  )
  return res.data
}

export async function deleteAttachment(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/tasks/${taskId}/attachments/${attachmentId}`)
}
