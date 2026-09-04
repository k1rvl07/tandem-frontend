import axios from 'axios'

export const http = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('tandem_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
