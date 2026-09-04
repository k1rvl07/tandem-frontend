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

export type TaskPriority = 'low' | 'medium' | 'high'

export interface Board {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface TaskAssignee {
  id: string
  login: string
  display_name: string
  avatar_key: string
}

export interface Task {
  id: string
  column_id: string
  title: string
  description: string
  priority: TaskPriority
  assignee: TaskAssignee | null
  due_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Column {
  id: string
  board_id: string
  name: string
  position: number
  task_count: number
  tasks: Task[]
  created_at: string
  updated_at: string
}

export interface BoardDetail {
  id: string
  workspace_id: string
  name: string
  position: number
  columns: Column[]
  created_at: string
  updated_at: string
}

export interface CreateBoardRequest {
  name: string
}

export interface UpdateBoardRequest {
  name: string
}

export interface CreateColumnRequest {
  name: string
}

export interface UpdateColumnRequest {
  name?: string
  position?: number
}

export interface CreateTaskRequest {
  column_id: string
  title: string
  description: string
  assignee_id?: string
  priority?: TaskPriority
  due_date?: string
}

export interface UpdateTaskRequest {
  column_id?: string
  title?: string
  description?: string
  assignee_id?: string
  priority?: TaskPriority
  due_date?: string
  position?: number
}
