<script setup lang="ts">
import { ref, watch } from 'vue'
import { getSignedUrl } from '@/api/files'

const props = defineProps<{
  src: string | null | undefined
  alt?: string
}>()

const signed = ref<string>()

watch(
  () => props.src,
  (key) => {
    if (!key) {
      signed.value = undefined
      return
    }
    getSignedUrl(key)
      .then((url) => {
        if (props.src === key) signed.value = url
      })
      .catch(() => {
        if (props.src === key) signed.value = undefined
      })
  },
  { immediate: true },
)
</script>

<template>
	<img :src="signed" :alt="alt" />
</template>