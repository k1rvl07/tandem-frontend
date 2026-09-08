import { describe, expect, it } from 'vitest'
import { decodeToken, isTokenUsable } from './jwt'

function b64url(payload: string): string {
  const padded = payload.length % 3 === 0 ? payload : payload + ' '.repeat(3 - (payload.length % 3))
  return btoa(padded).replace(/\+/g, '-').replace(/\//g, '_')
}

function makeToken(claims: unknown): string {
  return `h.${b64url(JSON.stringify(claims))}.s`
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600
}

describe('decodeToken', () => {
  it('parses valid three-part token claims', () => {
    const claims = { iss: 'tandem', aud: 'tandem', exp: futureExp() }
    expect(decodeToken(makeToken(claims))).toEqual(claims)
  })

  it('returns null for malformed token', () => {
    expect(decodeToken('not-a-jwt')).toBeNull()
    expect(decodeToken('a.b')).toBeNull()
  })

  it('returns null for invalid base64 payload', () => {
    expect(decodeToken('h.%%%.s')).toBeNull()
  })

  it('returns null for invalid json payload', () => {
    const raw = btoa('not json')
    expect(decodeToken(`h.${raw}.s`)).toBeNull()
  })
})

describe('isTokenUsable', () => {
  it('accepts token with matching issuer, audience and future exp', () => {
    expect(isTokenUsable(makeToken({ iss: 'tandem', aud: 'tandem', exp: futureExp() }))).toBe(true)
  })

  it('accepts audience as array containing tandem', () => {
    expect(
      isTokenUsable(makeToken({ iss: 'tandem', aud: ['other', 'tandem'], exp: futureExp() })),
    ).toBe(true)
  })

  it('rejects token without exp requirement only when missing', () => {
    expect(isTokenUsable(makeToken({ iss: 'tandem', aud: 'tandem' }))).toBe(true)
  })

  it('rejects expired token', () => {
    const claims = { iss: 'tandem', aud: 'tandem', exp: Math.floor(Date.now() / 1000) - 10 }
    expect(isTokenUsable(makeToken(claims))).toBe(false)
  })

  it('rejects token with wrong issuer', () => {
    expect(isTokenUsable(makeToken({ iss: 'other', aud: 'tandem', exp: futureExp() }))).toBe(false)
  })

  it('rejects token with wrong audience', () => {
    expect(isTokenUsable(makeToken({ iss: 'tandem', aud: 'api', exp: futureExp() }))).toBe(false)
  })

  it('rejects malformed token', () => {
    expect(isTokenUsable('garbage')).toBe(false)
  })
})
