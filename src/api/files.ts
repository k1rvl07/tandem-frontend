import { http } from '@/api/http'

export interface UploadImageResponse {
  key: string
  url: string
}

export async function uploadImage(file: File, namespace = 'avatars'): Promise<UploadImageResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await http.post<UploadImageResponse>(`/files/images?namespace=${namespace}`, form)
  return res.data
}

export function imageUrl(key: string): string {
  return `/api/v1/files/${key}`
}
