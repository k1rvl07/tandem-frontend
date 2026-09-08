import { describe, expect, it } from 'vitest'
import { boardFormSchema, taskFormSchema } from './schema'

describe('boardFormSchema', () => {
  it('accepts a valid name', () => {
    const result = boardFormSchema.safeParse({ name: 'Main board' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Main board')
    }
  })

  it('trims the name', () => {
    const result = boardFormSchema.safeParse({ name: '  Main  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Main')
    }
  })

  it('rejects empty and whitespace-only names', () => {
    expect(boardFormSchema.safeParse({ name: '' }).success).toBe(false)
    expect(boardFormSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('rejects names longer than 80 characters', () => {
    expect(boardFormSchema.safeParse({ name: 'a'.repeat(81) }).success).toBe(false)
  })
})

describe('taskFormSchema', () => {
  it('accepts a minimal valid task', () => {
    const result = taskFormSchema.safeParse({ title: 'Fix bugs', description: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        title: 'Fix bugs',
        is_urgent: false,
        is_hidden: false,
        due_date: '',
        assignee_id: '',
        board_id: '',
      })
    }
  })

  it('trims the title and requires it', () => {
    expect(taskFormSchema.safeParse({ title: '  ', description: '' }).success).toBe(false)
    const result = taskFormSchema.safeParse({ title: '  Ship it  ', description: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Ship it')
    }
  })

  it('rejects description longer than 1500 characters', () => {
    expect(taskFormSchema.safeParse({ title: 't', description: 'a'.repeat(1501) }).success).toBe(
      false,
    )
  })

  it('rejects malformed due date', () => {
    const result = taskFormSchema.safeParse({ title: 't', description: '', due_date: 'not-a-date' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('YYYY-MM-DD'))).toBe(true)
    }
  })

  it('accepts an empty due date', () => {
    expect(taskFormSchema.safeParse({ title: 't', description: '', due_date: '' }).success).toBe(
      true,
    )
  })
})
