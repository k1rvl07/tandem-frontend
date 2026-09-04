<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { collectErrors } from '@/shared/utils/validation'
import { type UpdateProfileFormValues, updateProfileSchema } from '../schema'

const props = defineProps<{
  displayName: string
  bio: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [values: UpdateProfileFormValues]
}>()

const values = reactive({
  display_name: '',
  bio: '',
})

const errors = ref<Partial<Record<keyof UpdateProfileFormValues, string>>>({})

onMounted(() => {
  values.display_name = props.displayName
  values.bio = props.bio
})

function onSubmit() {
  const result = updateProfileSchema.safeParse(values)
  if (!result.success) {
    errors.value = collectErrors(result.error.issues)
    return
  }
  errors.value = {}
  emit('submit', result.data)
}

function clearError(field: keyof UpdateProfileFormValues) {
  if (errors.value[field]) {
    delete errors.value[field]
  }
}
</script>

<template>
	<form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
		<div class="flex flex-col gap-1">
			<label for="display_name" class="text-sm">Display name</label>
			<input
				id="display_name"
				v-model="values.display_name"
				type="text"
				autocomplete="name"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('display_name')"
			/>
			<p v-if="errors.display_name" class="text-sm text-blue-700 dark:text-blue-400">
				{{ errors.display_name }}
			</p>
		</div>

		<div class="flex flex-col gap-1">
			<label for="bio" class="text-sm">Bio</label>
			<textarea
				id="bio"
				v-model="values.bio"
				rows="3"
				class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
				@input="clearError('bio')"
			></textarea>
			<p v-if="errors.bio" class="text-sm text-blue-700 dark:text-blue-400">{{ errors.bio }}</p>
		</div>

		<button
			type="submit"
			:disabled="props.submitting"
			class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
		>
			{{ props.submitting ? 'Saving...' : 'Save profile' }}
		</button>
	</form>
</template>
