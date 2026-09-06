<script setup lang="ts">
import { User } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { imageUrl } from '@/api/files'
import { useWS } from '@/api/ws'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{ withName?: boolean }>(), { withName: false })
const router = useRouter()
const auth = useAuthStore()
const ws = useWS()

const open = ref(false)

const isStaff = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'moderator')

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-menu="profile"]')) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

function onProfile() {
  open.value = false
  router.push('/profile')
}

function onAdmin() {
  open.value = false
  router.push('/admin')
}

async function onLogout() {
  open.value = false
  auth.logout()
  await router.push('/login')
}
</script>

<template>
	<div data-menu="profile" class="relative">
		<button
			type="button"
			class="flex items-center gap-2 focus:outline-none"
			@click="open = !open"
		>
			<span class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800">
				<img
					v-if="auth.user?.avatar_key"
					:src="imageUrl(auth.user.avatar_key)"
					alt="avatar"
					class="h-full w-full object-cover"
				/>
				<User v-else :size="18" class="text-blue-700 dark:text-blue-400" aria-hidden="true" />
				<span
					data-ws-indicator
					class="absolute right-0 top-0 h-1.5 w-1.5"
					:class="ws.connected.value ? 'bg-blue-700 dark:bg-blue-400' : 'bg-neutral-400 dark:bg-neutral-600'"
					:title="ws.connected.value ? 'Realtime connected' : 'Realtime disconnected'"
				/>
			</span>
			<span
				v-if="withName"
				class="max-w-40 truncate text-sm text-neutral-900 dark:text-neutral-100"
				:title="auth.user?.display_name || auth.user?.login || ''"
			>
				{{ auth.user?.display_name || auth.user?.login || '' }}
			</span>
		</button>
		<div
			v-if="open"
			class="absolute right-0 top-full z-30 mt-1 flex w-40 flex-col border border-neutral-300 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
		>
			<button
				type="button"
				class="px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
				@click="onProfile"
			>
				Profile
			</button>
			<button
				v-if="isStaff"
				type="button"
				class="px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
				@click="onAdmin"
			>
				Admin
			</button>
			<button
				type="button"
				class="px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
				@click="onLogout"
			>
				Logout
			</button>
		</div>
	</div>
</template>
