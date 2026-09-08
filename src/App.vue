<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HTTP_ERROR_EVENT, UNAUTHORIZED_EVENT } from '@/api/http'
import { useTheme } from '@/shared/composables/useTheme'
import ErrorBanner from '@/shared/ui/ErrorBanner.vue'
import { useAuthStore } from '@/stores/auth'

useTheme()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const errorMessage = ref<string | null>(null)

function onHttpError(event: Event) {
  const detail = (event as CustomEvent<string>).detail
  void nextTick(() => {
    if (errorMessage.value !== detail) {
      errorMessage.value = detail
    }
  })
}

function onUnauthorized(event: Event) {
  const redirect = (event as CustomEvent<string>).detail
  auth.clearSession()
  void router.replace({ name: 'login', query: { redirect } })
}

window.addEventListener(HTTP_ERROR_EVENT, onHttpError)
window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)

watch(
  () => route.fullPath,
  () => {
    errorMessage.value = null
  },
)

onBeforeUnmount(() => {
  window.removeEventListener(HTTP_ERROR_EVENT, onHttpError)
  window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
})
</script>

<template>
	<div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
		<ErrorBanner :message="errorMessage" />
		<RouterView />
	</div>
</template>