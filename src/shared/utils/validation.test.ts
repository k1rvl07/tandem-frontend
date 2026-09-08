import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { collectErrors } from './validation'

describe('collectErrors', () => {
  it('collects first issue message per top-level key', () => {
    const schema = z.object({
      login: z.string().min(3, 'login is too short'),
      password: z.string().min(1, 'password is required'),
    })
    const result = schema.safeParse({ login: 'ab', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const collected = collectErrors(result.error.issues)
      expect(collected).toEqual({
        login: 'login is too short',
        password: 'password is required',
      })
    }
  })

  it('keeps the first message when a key has multiple issues', () => {
    const schema = z.object({
      login: z
        .string()
        .min(3, 'too short')
        .regex(/^[a-z]+$/, 'lowercase only'),
    })
    const result = schema.safeParse({ login: 'AB' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const collected = collectErrors(result.error.issues)
      expect(collected.login).toBe('too short')
    }
  })

  it('returns empty map for no issues', () => {
    expect(collectErrors([])).toEqual({})
  })
})
