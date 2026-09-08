import { describe, expect, it } from 'vitest'
import { addMemberSchema, workspaceFormSchema } from './schema'

describe('workspaceFormSchema', () => {
  it('accepts a minimal valid workspace', () => {
    const result = workspaceFormSchema.safeParse({ name: 'Sprint board', description: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Sprint board')
    }
  })

  it('trims the name and rejects empty', () => {
    expect(workspaceFormSchema.safeParse({ name: '  ', description: '' }).success).toBe(false)
    const result = workspaceFormSchema.safeParse({ name: '  Release  ', description: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Release')
    }
  })

  it('rejects description longer than 400 characters', () => {
    expect(workspaceFormSchema.safeParse({ name: 'w', description: 'a'.repeat(401) }).success).toBe(
      false,
    )
  })

  it('uppercases a valid prefix', () => {
    const result = workspaceFormSchema.safeParse({ name: 'w', description: '', prefix: 'sprint' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.prefix).toBe('SPRINT')
    }
  })

  it('accepts an explicit empty prefix', () => {
    const result = workspaceFormSchema.safeParse({ name: 'w', description: '', prefix: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a prefix that does not start with a letter', () => {
    expect(
      workspaceFormSchema.safeParse({ name: 'w', description: '', prefix: '9abc' }).success,
    ).toBe(false)
  })

  it('rejects a prefix longer than 10 characters', () => {
    expect(
      workspaceFormSchema.safeParse({ name: 'w', description: '', prefix: 'ABCDEFGHIJK' }).success,
    ).toBe(false)
  })
})

describe('addMemberSchema', () => {
  it('defaults role to member', () => {
    const result = addMemberSchema.safeParse({ login: 'ivanov.ii' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('member')
    }
  })

  it('accepts editor role', () => {
    const result = addMemberSchema.safeParse({ login: 'ivanov.ii', role: 'editor' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role', () => {
    expect(addMemberSchema.safeParse({ login: 'ivanov.ii', role: 'owner' }).success).toBe(false)
  })

  it('requires a login', () => {
    expect(addMemberSchema.safeParse({ login: '  ' }).success).toBe(false)
  })
})
