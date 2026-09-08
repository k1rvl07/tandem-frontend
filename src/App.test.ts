import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { HTTP_ERROR_EVENT, UNAUTHORIZED_EVENT } from '@/api/http'
import App from './App.vue'
import type { User } from './shared/types'
import { makeToken } from './test/tokens'

vi.mock('@/api/http', () => ({
  HTTP_ERROR_EVENT: 'tandem:http-error',
  UNAUTHORIZED_EVENT: 'tandem:unauthorized',
  http: {},
}))

vi.mock('@/shared/composables/useTheme', () => ({
  useTheme: () => undefined,
}))

const TOKEN_KEY = 'tandem_token'
const USER_KEY = 'tandem_user'

const user: User = {
  id: 'u1',
  login: 'ivanov.ii',
  role: 'user',
  display_name: 'Ivan',
  bio: '',
  avatar_key: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

let router: Router

async function mountApp(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { name: 'HomeStub', render: () => h('div') } },
      { path: '/login', name: 'login', component: { name: 'LoginStub', render: () => h('div') } },
    ],
  })
  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })
  await router.isReady()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('App events', () => {
  it('clears the session and redirects to login on unauthorized event', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken())
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    const wrapper = await mountApp()

    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: '/workspaces/ws1' }))
    await flushPromises()

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/workspaces/ws1')
    wrapper.unmount()
  })

  it('shows an http error banner', async () => {
    const wrapper = await mountApp()

    window.dispatchEvent(new CustomEvent(HTTP_ERROR_EVENT, { detail: 'Too many requests' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Too many requests')
    wrapper.unmount()
  })

  it('clears the error banner on route change', async () => {
    const wrapper = await mountApp()

    window.dispatchEvent(new CustomEvent(HTTP_ERROR_EVENT, { detail: 'Server error' }))
    await flushPromises()
    expect(wrapper.text()).toContain('Server error')

    await router.push('/home')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Server error')
    wrapper.unmount()
  })
})
