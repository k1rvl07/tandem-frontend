import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/api/http', () => ({ http: mocks.http }))

import { getSignedUrl, uploadImage } from './files'

describe('uploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the file and returns the key', async () => {
    mocks.http.post.mockResolvedValueOnce({ data: { key: 'avatars/abc.png' } })
    const file = new File(['x'], 'avatar.png', { type: 'image/png' })
    const res = await uploadImage(file)
    expect(res.key).toBe('avatars/abc.png')
    expect(mocks.http.post).toHaveBeenCalledTimes(1)
    expect(mocks.http.post.mock.calls[0][0]).toBe('/files/images?namespace=avatars')
  })
})

describe('getSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.http.get.mockReset()
  })

  it('requests a signed url', async () => {
    mocks.http.get.mockResolvedValueOnce({ data: { url: 'https://cdn/obj' } })
    await expect(getSignedUrl('files/1.png')).resolves.toBe('https://cdn/obj')
    expect(mocks.http.get).toHaveBeenCalledWith('/files/sign', { params: { key: 'files/1.png' } })
  })

  it('caches the url within the ttl', async () => {
    mocks.http.get.mockResolvedValue({ data: { url: 'https://cdn/obj' } })
    const first = await getSignedUrl('cache-1.png')
    const second = await getSignedUrl('cache-1.png')
    expect(first).toBe(second)
    expect(mocks.http.get).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent requests for the same key', async () => {
    mocks.http.get.mockResolvedValue({ data: { url: 'https://cdn/obj' } })
    const results = await Promise.all([
      getSignedUrl('inflight-1.png'),
      getSignedUrl('inflight-1.png'),
      getSignedUrl('inflight-1.png'),
    ])
    expect(results).toHaveLength(3)
    expect(mocks.http.get).toHaveBeenCalledTimes(1)
  })

  it('re-requests after the ttl expires', async () => {
    vi.useFakeTimers()
    try {
      mocks.http.get.mockResolvedValue({ data: { url: 'https://cdn/obj' } })
      await getSignedUrl('ttl-key.png')
      expect(mocks.http.get).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(50 * 60 * 1000 + 1000)
      mocks.http.get.mockClear()
      mocks.http.get.mockResolvedValue({ data: { url: 'https://cdn/obj' } })
      await getSignedUrl('ttl-key.png')
      expect(mocks.http.get).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
})
