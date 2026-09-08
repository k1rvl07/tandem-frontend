import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from '@playwright/test'

const apiUrl = 'http://localhost:8080/api/v1'
const frontendUrl = 'http://localhost:5173'
const login = process.env.E2E_ADMIN_LOGIN ?? 'admin'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'AdminPass123!'

async function loginAsAdmin() {
  const ctx = await request.newContext()
  let token = ''
  for (let i = 0; i < 40; i++) {
    const res = await ctx.post(`${apiUrl}/auth/login`, { data: { login, password } })
    if (res.ok()) {
      token = ((await res.json()) as { token: string }).token
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  if (!token) {
    throw new Error(`unable to authenticate as ${login} against ${apiUrl}`)
  }
  await ctx.dispose()
  return token
}

async function waitForBackend() {
  const ctx = await request.newContext()
  for (let i = 0; i < 60; i++) {
    try {
      const res = await ctx.get('http://localhost:8080/healthz')
      if (res.ok()) {
        await ctx.dispose()
        return
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  await ctx.dispose()
}

export default async function globalSetup() {
  await waitForBackend()
  const token = await loginAsAdmin()
  const ctx = await request.newContext()
  const userRes = await ctx.get(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const user = userRes.ok()
    ? await userRes.json()
    : { id: '', login, role: 'admin', display_name: login, bio: '', avatar_key: '' }
  await ctx.dispose()
  const state = {
    cookies: [],
    origins: [
      {
        origin: frontendUrl,
        localStorage: [
          { name: 'tandem_token', value: token },
          { name: 'tandem_user', value: user ? JSON.stringify(user) : '{}' },
        ],
      },
    ],
  }
  const file = join(fileURLToPath(new URL('.', import.meta.url)), '.auth', 'admin.json')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2))
}
