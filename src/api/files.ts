import { http } from '@/api/http'

export interface UploadImageResponse {
  key: string
}

const SIGNED_TTL = 50 * 60 * 1000

const signedCache = new Map<string, { url: string; expiresAt: number }>()
const inflight = new Map<string, Promise<string>>()

export async function uploadImage(file: File, namespace = 'avatars'): Promise<UploadImageResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await http.post<UploadImageResponse>(`/files/images?namespace=${namespace}`, form)
  return res.data
}

export async function getSignedUrl(key: string): Promise<string> {
  const now = Date.now()
  const hit = signedCache.get(key)
  if (hit && hit.expiresAt > now) return hit.url
  const pending = inflight.get(key)
  if (pending) return pending
  const promise = http
    .get<{ url: string }>('/files/sign', { params: { key } })
    .then((res) => {
      signedCache.set(key, { url: res.data.url, expiresAt: now + SIGNED_TTL })
      return res.data.url
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
  return promise
}
