<script setup lang="ts">
import { reactive, ref } from 'vue'
import { collectErrors } from '@/shared/utils/validation'
import { type LoginFormValues, loginSchema } from '../schema'

const values = reactive({
  login: '',
  password: '',
})

const errors = ref<Partial<Record<keyof LoginFormValues, string>>>({})

const props = defineProps<{
  submitLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [values: LoginFormValues]
}>()

function onSubmit() {
  const result = loginSchema.safeParse(values)
  if (!result.success) {
    errors.value = collectErrors(result.error.issues)
    return
  }
  errors.value = {}
  emit('submit', result.data)
}

function clearError(field: keyof LoginFormValues) {
  if (errors.value[field]) {
    delete errors.value[field]
  }
}
</script>

<template>
	<form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
		<div class="flex flex-col gap-1">
			<label for="login" class="text-sm">Login</label>
			<input
				id="login"
				v-model="values.login"
				type="text"
				maxlength="50"
				autocomplete="username"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('login')"
			/>
			<p v-if="errors.login" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.login }}
			</p>
		</div>

		<div class="flex flex-col gap-1">
			<label for="password" class="text-sm">Password</label>
			<input
				id="password"
				v-model="values.password"
				type="password"
				maxlength="72"
				autocomplete="current-password"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('password')"
			/>
			<p v-if="errors.password" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.password }}
			</p>
		</div>

		<button
			type="submit"
			:disabled="props.disabled"
			class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
		>
			{{ props.submitLabel ?? 'Login' }}
		</button>
	</form>
</template>
