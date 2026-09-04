<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark({
  storageKey: 'tandem_theme',
  attribute: 'class',
  selector: 'html',
})
const toggleDark = useToggle(isDark)
</script>

<template>
	<div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
		<button
			type="button"
			class="fixed right-4 top-4 border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
			@click="toggleDark()"
		>
			{{ isDark ? 'Light' : 'Dark' }}
		</button>
		<RouterView />
	</div>
</template>