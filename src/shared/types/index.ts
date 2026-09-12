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

export interface TokenPair {
  token: string
  refresh_token: string
}

export interface LoginResponse extends TokenPair {
  user: User
}

export interface RefreshResponse extends TokenPair {}

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

export type WorkspaceRole = 'owner' | 'editor' | 'member'

export interface Workspace {
  id: string
  name: string
  description: string
  prefix: string
  theme: string
  role: WorkspaceRole
  is_favorite: boolean
  owner: WorkspaceMember | null
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
  prefix: string
  theme: string
  role: WorkspaceRole
  is_favorite: boolean
  created_at: string
  updated_at: string
  members: WorkspaceMember[]
}

export interface CreateWorkspaceRequest {
  name: string
  description: string
  prefix?: string
}

export interface UpdateWorkspaceRequest {
  name: string
  description: string
  prefix?: string
}

export interface SetThemeRequest {
  theme: string
}

export interface AddMemberRequest {
  login: string
  role: WorkspaceRole
}

export interface UpdateMemberRoleRequest {
  role: WorkspaceRole
}

export interface TransferOwnerRequest {
  user_id: string
}

export interface WorkspaceInvite {
  invite_token: string | null
  expires_at?: string | null
}

export interface Board {
  id: string
  workspace_id: string
  name: string
  position: number
  is_main: boolean
  is_favorite: boolean
  task_count: number
  created_at: string
  updated_at: string
}

export interface ReorderBoardsRequest {
  board_ids: string[]
}

export interface TaskAssignee {
  id: string
  login: string
  display_name: string
  avatar_key: string
}

export interface Task {
  id: string
  display_id: string
  workspace_id: string
  board_id: string
  board_name: string
  column_id: string
  column_name: string
  title: string
  description: string
  author: TaskAssignee | null
  assignee: TaskAssignee | null
  curator: TaskAssignee | null
  parent_id: string
  due_date: string | null
  position: number
  is_urgent: boolean
  is_hidden: boolean
  image_key: string
  created_at: string
  updated_at: string
}

export interface TaskReference {
  id: string
  display_id: string
  title: string
  workspace_id: string
  board_id: string
  board_name: string
  column_id: string
  column_name: string
  is_urgent: boolean
  is_hidden: boolean
}

export interface TaskDetail extends Task {
  parent: TaskReference | null
  subtasks: TaskReference[]
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
  is_main: boolean
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

export interface CreateTaskRequest {
  column_id: string
  title: string
  description: string
  assignee_id?: string
  curator_id?: string
  parent_id?: string
  due_date?: string
  is_urgent?: boolean
  is_hidden?: boolean
  image_key?: string
}

export interface UpdateTaskRequest {
  board_id?: string
  column_id?: string
  title?: string
  description?: string
  assignee_id?: string
  curator_id?: string
  parent_id?: string
  due_date?: string
  position?: number
  is_urgent?: boolean
  is_hidden?: boolean
  image_key?: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  filename: string
  content_type: string
  size: number
  uploaded_by: string
  created_at: string
  url: string
}

export interface TreeBoard {
  board: Board
  tasks: Task[]
}

export interface TreeWorkspace {
  workspace: Workspace
  boards: TreeBoard[]
}

export interface TaskTreeQuery {
  tasks?: 'all' | 'mine' | 'for_me'
  boards?: 'all' | 'fav'
  workspaces?: 'all' | 'fav'
}
