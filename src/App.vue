<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const isDark = useDark({
  storageKey: 'tandem_theme',
  attribute: 'class',
  selector: 'html',
})
const toggleDark = useToggle(isDark)

const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
	<div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
		<header
			v-if="auth.isAuthenticated"
			class="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
		>
			<RouterLink to="/profile" class="text-lg font-semibold text-neutral-900 hover:text-blue-700 dark:text-neutral-100 dark:hover:text-blue-400">
				Tandem
			</RouterLink>
			<div class="flex items-center gap-4">
				<RouterLink
					to="/workspaces"
					class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
				>
					Workspaces
				</RouterLink>
				<RouterLink
					v-if="auth.user?.role === 'admin' || auth.user?.role === 'moderator'"
					to="/admin"
					class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
				>
					Admin
				</RouterLink>
				<button
					type="button"
					class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					@click="toggleDark()"
				>
					{{ isDark ? 'Light' : 'Dark' }}
				</button>
				<button
					type="button"
					class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					@click="onLogout"
				>
					Logout
				</button>
			</div>
		</header>
		<RouterView />
	</div>
</template>