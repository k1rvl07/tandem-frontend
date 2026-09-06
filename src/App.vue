<script setup lang="ts">
import { useTheme } from '@/shared/composables/useTheme'

useTheme()
</script>

<template>
	<div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
		<RouterView />
	</div>
</template>