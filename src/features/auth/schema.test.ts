import { describe, expect, it } from 'vitest'
import { loginSchema } from './schema'

describe('loginSchema', () => {
  it('accepts a valid login', () => {
    expect(loginSchema.safeParse({ login: 'ivanov.ii', password: 'secret' }).success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = loginSchema.safeParse({ login: '  ivanov.ii  ', password: 'secret' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.login).toBe('ivanov.ii')
    }
  })

  it('rejects login shorter than 3 characters', () => {
    const result = loginSchema.safeParse({ login: 'ab', password: 'secret' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('at least 3'))).toBe(true)
    }
  })

  it('rejects login with uppercase characters', () => {
    expect(loginSchema.safeParse({ login: 'Ivanov', password: 'secret' }).success).toBe(false)
  })

  it('rejects login with spaces inside', () => {
    expect(loginSchema.safeParse({ login: 'ivan ov', password: 'secret' }).success).toBe(false)
  })

  it('accepts dots, dashes, underscores and digits', () => {
    expect(loginSchema.safeParse({ login: 'a.b-c_d9', password: 'secret' }).success).toBe(true)
  })

  it('requires a non-empty password', () => {
    const result = loginSchema.safeParse({ login: 'ivanov.ii', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'password is required')).toBe(true)
    }
  })
})
