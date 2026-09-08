import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/features/home/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/features/profile/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/features/admin/views/AdminView.vue'),
      meta: { requiresAuth: true, requiresStaff: true },
    },
    {
      path: '/workspaces/:id',
      name: 'workspace',
      component: () => import('@/features/workspaces/views/WorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/invite/:token',
      name: 'invite-join',
      component: () => import('@/features/workspaces/views/JoinView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workspaces/:id/boards/:boardId',
      name: 'board-legacy',
      redirect: (to) => ({
        path: `/workspaces/${to.params.id}`,
        query: { ...to.query, board: to.params.boardId },
      }),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  const role = auth.user?.role
  if (to.meta.requiresStaff && role !== 'admin' && role !== 'moderator') {
    return { name: 'profile' }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }
  return true
})

export default router
