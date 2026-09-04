<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { extractError } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import LoginForm from '../components/LoginForm.vue'
import type { LoginFormValues } from '../schema'

const router = useRouter()
const auth = useAuthStore()

const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit(values: LoginFormValues) {
  error.value = null
  submitting.value = true
  try {
    await auth.login(values)
    await router.push('/')
  } catch (e) {
    error.value = extractError(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
	<div class="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
		<div class="w-full max-w-sm border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
			<h1 class="mb-4 text-xl text-neutral-900 dark:text-neutral-100">Welcome back</h1>
			<LoginForm :submit-label="submitting ? 'Signing in...' : 'Login'" :disabled="submitting" @submit="onSubmit" />
			<p v-if="error" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ error }}</p>
			<p class="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
				Account is provisioned by your administrator.
			</p>
		</div>
	</div>
</template>