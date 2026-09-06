<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { extractError } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import { joinByInvite } from '../api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = String(route.params.token)
const joining = ref(false)
const joinError = ref<string | null>(null)

async function onJoin() {
  joining.value = true
  joinError.value = null
  try {
    const ws = await joinByInvite(token)
    await router.push(`/workspaces/${ws.id}`)
  } catch (e) {
    joinError.value = extractError(e)
  } finally {
    joining.value = false
  }
}
</script>

<template>
	<div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
		<div class="relative w-full max-w-md border border-neutral-300 bg-white p-8 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
			<button
				type="button"
				aria-label="Close"
				class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
				@click="router.push(auth.isAuthenticated ? '/' : '/login')"
			>
				✕
			</button>
			<h1 class="text-xl font-medium text-neutral-900 dark:text-neutral-100">Join workspace</h1>
			<p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
				You have been invited to join this workspace by link.
			</p>
			<p v-if="joinError" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ joinError }}</p>
			<div class="mt-6 flex justify-end">
				<button
					type="button"
					:disabled="joining"
					class="bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
					@click="onJoin"
				>
					{{ joining ? 'Joining…' : 'Join' }}
				</button>
			</div>
		</div>
	</div>
</template>