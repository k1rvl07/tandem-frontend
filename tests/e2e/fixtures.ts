import { test as base } from '@playwright/test'
import { Api } from './helpers/api'

export const test = base.extend<{ api: Api }>({
  api: async ({ request }, use) => {
    const api = await Api.login(request)
    await use(api)
    await api.cleanup()
  },
})

export const expect = base.expect
