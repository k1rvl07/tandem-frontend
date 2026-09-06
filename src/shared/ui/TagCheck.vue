<script setup lang="ts">
import { Check } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<(e: 'update:modelValue', value: boolean) => void>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="relative flex items-center border border-neutral-300 bg-white text-left outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
    :class="
      props.compact
        ? 'h-8 pl-[2.5rem] pr-3'
        : 'min-h-[2.8rem] pl-[3rem] pr-4'
    "
    @click="toggle"
  >
    <span
      class="absolute top-1/2 flex -translate-y-1/2 items-center justify-center border border-neutral-400 bg-white dark:border-neutral-500 dark:bg-neutral-900"
      :class="[
        props.compact ? 'left-[0.5rem] h-[1.25rem] w-[1.25rem]' : 'left-[0.7rem] h-[1.4rem] w-[1.4rem]',
        {
          'border-blue-700 bg-blue-700 dark:border-blue-500 dark:bg-blue-500': modelValue,
        },
      ]"
    >
      <Check v-if="modelValue" :class="props.compact ? 'h-3 w-3' : 'h-3.5 w-3.5'" class="text-white" />
    </span>
    <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ label }}</span>
  </button>
</template>