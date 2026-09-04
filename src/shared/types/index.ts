export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface RegisterRequest {
  email: string
  password: string
  confirm_password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface ApiError {
  error: string
}
