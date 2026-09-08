import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User, UserRole } from '@/shared/types'
import { makeToken } from '@/test/tokens'
import router from './index'

vi.mock('@/features/home/views/HomeView.vue', async () => {
  const { h } = await import('vue')
  return { default: { name: 'HomeView', render: () => h('div') } }
})
vi.mock('@/features/auth/views/LoginView.vue', async () => {
  const { h } = await import('vue')
  return { default: { name: 'LoginView', render: () => h('div') } }
})
vi.mock('@/features/profile/views/ProfileView.vue', async () => {
  const { h } = await import('vue')
  return { default: { name: 'ProfileView', render: () => h('div') } }
})
vi.mock('@/features/admin/views/AdminView.vue', async () => {
  const { h } = await import('vue')
  return { default: { name: 'AdminView', render: () => h('div') } }
})

const TOKEN_KEY = 'tandem_token'
const USER_KEY = 'tandem_user'

function baseUser(role: UserRole): User {
  return {
    id: 'u1',
    login: 'ivanov.ii',
    role,
    display_name: 'Ivan',
    bio: '',
    avatar_key: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function seedSession(role: UserRole) {
  localStorage.setItem(TOKEN_KEY, makeToken())
  localStorage.setItem(USER_KEY, JSON.stringify(baseUser(role)))
}

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  await router.replace({ name: 'home' })
  await router.isReady()
})

describe('router guards', () => {
  it('redirects unauthenticated users to login with a redirect query', async () => {
    await router.push({ name: 'profile' })
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })

  it('sends authenticated users from login to home', async () => {
    seedSession('user')
    setActivePinia(createPinia())
    await router.push({ name: 'login' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('blocks non-staff users from the admin area', async () => {
    seedSession('user')
    setActivePinia(createPinia())
    await router.push({ name: 'admin' })
    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('allows admins into the admin area', async () => {
    seedSession('admin')
    setActivePinia(createPinia())
    await router.push({ name: 'admin' })
    expect(router.currentRoute.value.name).toBe('admin')
  })

  it('allows moderators into the admin area', async () => {
    seedSession('moderator')
    setActivePinia(createPinia())
    await router.push({ name: 'admin' })
    expect(router.currentRoute.value.name).toBe('admin')
  })
})
