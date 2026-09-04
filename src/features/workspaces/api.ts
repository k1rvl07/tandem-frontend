import { http } from '@/api/http'
import type {
  AddMemberRequest,
  CreateWorkspaceRequest,
  TransferOwnerRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceDetail,
  WorkspaceMember,
} from '@/shared/types'

export async function createWorkspace(payload: CreateWorkspaceRequest): Promise<Workspace> {
  const res = await http.post<Workspace>('/workspaces', payload)
  return res.data
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const res = await http.get<Workspace[]>('/workspaces')
  return res.data
}

export async function getWorkspace(id: string): Promise<WorkspaceDetail> {
  const res = await http.get<WorkspaceDetail>(`/workspaces/${id}`)
  return res.data
}

export async function updateWorkspace(
  id: string,
  payload: UpdateWorkspaceRequest,
): Promise<Workspace> {
  const res = await http.patch<Workspace>(`/workspaces/${id}`, payload)
  return res.data
}

export async function deleteWorkspace(id: string): Promise<void> {
  await http.delete(`/workspaces/${id}`)
}

export async function addMember(id: string, payload: AddMemberRequest): Promise<WorkspaceMember> {
  const res = await http.post<WorkspaceMember>(`/workspaces/${id}/members`, payload)
  return res.data
}

export async function removeMember(id: string, userId: string): Promise<void> {
  await http.delete(`/workspaces/${id}/members/${userId}`)
}

export async function transferOwner(id: string, payload: TransferOwnerRequest): Promise<void> {
  await http.post(`/workspaces/${id}/owner`, payload)
}
