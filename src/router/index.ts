import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/profile',
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
      path: '/workspaces',
      name: 'workspaces',
      component: () => import('@/features/workspaces/views/WorkspacesListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workspaces/:id',
      name: 'workspace',
      component: () => import('@/features/workspaces/views/WorkspaceView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workspaces/:id/boards/:boardId',
      name: 'board',
      component: () => import('@/features/boards/views/BoardView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  const role = auth.user?.role
  if (to.meta.requiresStaff && role !== 'admin' && role !== 'moderator') {
    return { name: 'profile' }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'profile' }
  }
  return true
})

export default router
