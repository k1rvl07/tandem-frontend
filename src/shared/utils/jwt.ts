interface JWTClaims {
  exp?: number
  iss?: string
  aud?: string | string[]
}

export function decodeToken(token: string): JWTClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  let raw: string
  try {
    raw = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  try {
    return JSON.parse(raw) as JWTClaims
  } catch {
    return null
  }
}

export function isTokenUsable(token: string): boolean {
  const claims = decodeToken(token)
  if (!claims) {
    return false
  }
  if (claims.iss !== 'tandem') {
    return false
  }
  const audience = claims.aud
  const hasAudience =
    typeof audience === 'string'
      ? audience === 'tandem'
      : Array.isArray(audience) && audience.includes('tandem')
  if (!hasAudience) {
    return false
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
    return false
  }
  return true
}
