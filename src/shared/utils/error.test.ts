import { describe, expect, it } from 'vitest'
import { extractError } from './error'

describe('extractError', () => {
  it('returns server error message', () => {
    expect(extractError({ response: { data: { error: 'validation failed' } } })).toBe(
      'validation failed',
    )
  })

  it('returns fallback for missing error field', () => {
    expect(extractError({ response: { data: {} } })).toBe('something went wrong')
  })

  it('returns fallback for plain objects without response', () => {
    expect(extractError({ message: 'boom' })).toBe('something went wrong')
  })

  it('returns fallback for strings', () => {
    expect(extractError('boom')).toBe('something went wrong')
  })

  it('returns fallback for null and undefined', () => {
    expect(extractError(null)).toBe('something went wrong')
    expect(extractError(undefined)).toBe('something went wrong')
  })

  it('returns fallback for primitive errors', () => {
    expect(extractError(42)).toBe('something went wrong')
  })
})
