import type { APIRequestContext } from '@playwright/test'

const API_BASE = 'http://localhost:8080/api/v1'

interface WorkspaceName {
  id: string
  name: string
}

export class Api {
  private constructor(
    private readonly ctx: APIRequestContext,
    private readonly token: string,
    readonly runId: string,
  ) {}

  static async login(ctx: APIRequestContext): Promise<Api> {
    const login = process.env.E2E_ADMIN_LOGIN ?? 'admin'
    const password = process.env.E2E_ADMIN_PASSWORD ?? 'AdminPass123!'
    const res = await ctx.post(`${API_BASE}/auth/login`, { data: { login, password } })
    if (!res.ok()) {
      throw new Error(`admin login failed: ${res.status()} ${await res.text()}`)
    }
    const body = (await res.json()) as { token: string }
    return new Api(ctx, body.token, Date.now().toString(36))
  }

  private async request(path: string, init: Parameters<APIRequestContext['fetch']>[1] = {}) {
    const headers = { ...(init.headers ?? {}), Authorization: `Bearer ${this.token}` }
    const res = await this.ctx.fetch(`${API_BASE}${path}`, { ...init, headers })
    if (!res.ok()) {
      throw new Error(`api ${path}: ${res.status()} ${await res.text()}`)
    }
    return res
  }

  name(prefix: string): string {
    return `e2e-${this.runId}-${prefix}`
  }

  runPrefix(): string {
    return `e2e-${this.runId}-`
  }

  async createWorkspace(name: string): Promise<string> {
    const res = await this.request('/workspaces', {
      method: 'POST',
      data: { name, description: '', prefix: 'E2E' },
    })
    const body = (await res.json()) as { id: string }
    return body.id
  }

  async listWorkspaces(): Promise<WorkspaceName[]> {
    const res = await this.request('/workspaces')
    return (await res.json()) as WorkspaceName[]
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.request(`/workspaces/${id}`, { method: 'DELETE' })
  }

  async cleanup(): Promise<void> {
    for (const ws of await this.listWorkspaces()) {
      if (ws.name.startsWith(this.runPrefix())) {
        try {
          await this.deleteWorkspace(ws.id)
        } catch {}
      }
    }
  }
}
