import { http } from '@/api/http'
import type {
  AddMemberRequest,
  CreateWorkspaceRequest,
  SetThemeRequest,
  TransferOwnerRequest,
  UpdateMemberRoleRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceDetail,
  WorkspaceInvite,
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

export async function setWorkspaceTheme(id: string, payload: SetThemeRequest): Promise<Workspace> {
  const res = await http.put<Workspace>(`/workspaces/${id}/theme`, payload)
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

export async function updateMemberRole(
  id: string,
  userId: string,
  payload: UpdateMemberRoleRequest,
): Promise<WorkspaceMember> {
  const res = await http.patch<WorkspaceMember>(`/workspaces/${id}/members/${userId}`, payload)
  return res.data
}

export async function transferOwner(id: string, payload: TransferOwnerRequest): Promise<void> {
  await http.post(`/workspaces/${id}/owner`, payload)
}

export async function getInvite(id: string): Promise<WorkspaceInvite> {
  const res = await http.get<WorkspaceInvite>(`/workspaces/${id}/invite`)
  return res.data
}

export async function disableInvite(id: string): Promise<void> {
  await http.delete(`/workspaces/${id}/invite`)
}

export async function joinByInvite(token: string): Promise<Workspace> {
  const res = await http.post<Workspace>(`/invite/${token}/join`)
  return res.data
}

export async function addWorkspaceFavorite(workspaceId: string): Promise<void> {
  await http.put(`/favorites/workspaces/${workspaceId}`)
}

export async function removeWorkspaceFavorite(workspaceId: string): Promise<void> {
  await http.delete(`/favorites/workspaces/${workspaceId}`)
}
