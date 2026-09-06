<script setup lang="ts">
import { reactive, ref } from 'vue'
import { collectErrors } from '@/shared/utils/validation'
import { type ChangePasswordFormValues, changePasswordSchema } from '../schema'

const props = defineProps<{
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [values: ChangePasswordFormValues]
}>()

const values = reactive({
  new_password: '',
  confirm_password: '',
  current_password: '',
})

const errors = ref<Partial<Record<keyof ChangePasswordFormValues, string>>>({})

function onSubmit() {
  const result = changePasswordSchema.safeParse(values)
  if (!result.success) {
    errors.value = collectErrors(result.error.issues)
    return
  }
  errors.value = {}
  emit('submit', result.data)
}

function clearError(field: keyof ChangePasswordFormValues) {
  if (errors.value[field]) {
    delete errors.value[field]
  }
}
</script>

<template>
	<form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
		<div class="flex flex-col gap-1">
			<label for="new_password" class="text-sm">New password</label>
			<input
				id="new_password"
				v-model="values.new_password"
				type="password"
				maxlength="72"
				autocomplete="new-password"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('new_password')"
			/>
			<p v-if="errors.new_password" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.new_password }}
			</p>
		</div>

		<div class="flex flex-col gap-1">
			<label for="confirm_password" class="text-sm">Confirm new password</label>
			<input
				id="confirm_password"
				v-model="values.confirm_password"
				type="password"
				maxlength="72"
				autocomplete="new-password"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('confirm_password')"
			/>
			<p v-if="errors.confirm_password" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.confirm_password }}
			</p>
		</div>

		<div class="flex flex-col gap-1">
			<label for="current_password" class="text-sm">Current password</label>
			<input
				id="current_password"
				v-model="values.current_password"
				type="password"
				maxlength="72"
				autocomplete="current-password"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('current_password')"
			/>
			<p v-if="errors.current_password" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.current_password }}
			</p>
		</div>

		<button
			type="submit"
			:disabled="props.submitting"
			class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
		>
			{{ props.submitting ? 'Changing...' : 'Change password' }}
		</button>
	</form>
</template>