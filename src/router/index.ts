import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/register',
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/views/RegisterView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/views/LoginView.vue'),
    },
  ],
})

export default router
