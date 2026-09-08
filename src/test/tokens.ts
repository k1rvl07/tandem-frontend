export function makeToken(overrides: Record<string, unknown> = {}): string {
  const claims = {
    iss: 'tandem',
    aud: 'tandem',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
  const encoded = new TextEncoder().encode(JSON.stringify(claims))
  let binary = ''
  for (const byte of encoded) {
    binary += String.fromCharCode(byte)
  }
  const b64 = btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${b64}.signature`
}
