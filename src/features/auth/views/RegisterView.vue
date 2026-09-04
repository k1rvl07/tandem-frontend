<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { extractError } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import RegisterForm from '../components/RegisterForm.vue'
import type { RegisterFormValues } from '../schema'

const router = useRouter()
const auth = useAuthStore()

const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit(values: RegisterFormValues) {
  error.value = null
  submitting.value = true
  try {
    await auth.register(values)
    await router.push('/login')
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
			<h1 class="mb-4 text-xl text-neutral-900 dark:text-neutral-100">Create account</h1>
			<RegisterForm :submit-label="submitting ? 'Signing up...' : 'Register'" :disabled="submitting" @submit="onSubmit" />
			<p v-if="error" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ error }}</p>
			<p class="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
				Already have an account?
				<RouterLink to="/login" class="text-blue-700 hover:underline dark:text-blue-400">Login</RouterLink>
			</p>
		</div>
	</div>
</template>