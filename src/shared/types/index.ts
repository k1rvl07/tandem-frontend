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
