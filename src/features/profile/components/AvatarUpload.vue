<script setup lang="ts">
import { User } from 'lucide-vue-next'
import { ref } from 'vue'
import SignedImage from '@/shared/ui/SignedImage.vue'

const props = defineProps<{
  avatarKey: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  upload: [file: File]
  remove: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('upload', file)
  }
}

function onClick() {
  fileInput.value?.click()
}
</script>

<template>
	<div class="flex items-center gap-4">
		<div
			class="flex h-20 w-20 items-center justify-center border border-neutral-300 bg-neutral-100 text-2xl font-semibold text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
		>
<SignedImage
				v-if="props.avatarKey"
				:src="props.avatarKey"
				alt="avatar"
				class="h-full w-full object-cover"
			/>
			<User v-else :size="40" stroke-width="1.25" class="text-blue-700 dark:text-blue-400" aria-hidden="true" />
		</div>
		<input
			ref="fileInput"
			type="file"
			accept="image/png,image/jpeg,image/webp,image/gif"
			class="hidden"
			@change="onSelect"
		/>
		<button
			type="button"
			v-if="props.avatarKey"
			:disabled="props.submitting"
			class="border border-neutral-300 px-4 py-2 text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
			@click="emit('remove')"
		>
			Remove
		</button>
		<button
			type="button"
			:disabled="props.submitting"
			class="border border-blue-700 px-4 py-2 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
			@click="onClick"
		>
			{{ props.submitting ? 'Uploading...' : 'Upload avatar' }}
		</button>
	</div>
</template>