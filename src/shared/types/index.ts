export type UserRole = 'admin' | 'moderator' | 'user'

export interface User {
  id: string
  login: string
  role: UserRole
  display_name: string
  bio: string
  avatar_key: string
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  login: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface ApiError {
  error: string
}

export interface CreateUserRequest {
  login: string
  password: string
  display_name: string
  role: UserRole
}

export interface UpdateProfileRequest {
  display_name: string
  bio: string
}

export interface ChangePasswordRequest {
  new_password: string
  current_password: string
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'

export interface Workspace {
  id: string
  name: string
  description: string
  role: WorkspaceRole
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  login: string
  display_name: string
  avatar_key: string
  role: WorkspaceRole
  joined_at: string
}

export interface WorkspaceDetail {
  id: string
  name: string
  description: string
  role: WorkspaceRole
  created_at: string
  updated_at: string
  members: WorkspaceMember[]
}

export interface CreateWorkspaceRequest {
  name: string
  description: string
}

export interface UpdateWorkspaceRequest {
  name: string
  description: string
}

export interface AddMemberRequest {
  login: string
  role: WorkspaceRole
}

export interface TransferOwnerRequest {
  user_id: string
}
