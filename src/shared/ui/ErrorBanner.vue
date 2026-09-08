<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ message: string | null }>()

const visible = ref(false)
let timer: number | null = null

watch(
  () => props.message,
  (value) => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    if (value) {
      visible.value = true
      timer = window.setTimeout(() => {
        visible.value = false
      }, 8000)
    } else {
      visible.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer !== null) {
    window.clearTimeout(timer)
  }
})
</script>

<template>
	<div
		v-if="visible"
		class="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b border-blue-700 bg-white px-4 py-2 text-sm text-blue-700 shadow-lg dark:border-blue-400 dark:bg-neutral-900 dark:text-blue-400"
	>
		<span>{{ message }}</span>
		<button
			type="button"
			aria-label="Dismiss"
			class="font-semibold"
			@click="visible = false"
		>
			✕
		</button>
	</div>
</template>