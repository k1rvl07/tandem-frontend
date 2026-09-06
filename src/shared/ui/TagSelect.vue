<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

interface Option {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    options: Option[]
    allowEmpty?: boolean
    emptyLabel?: string
    disabled?: boolean
    compact?: boolean
    valueMaxW?: string
  }>(),
  {
    allowEmpty: false,
    emptyLabel: 'none',
    disabled: false,
    compact: false,
    valueMaxW: 'max-w-52',
  },
)

const emit = defineEmits<(e: 'update:modelValue', value: string) => void>()

const open = ref(false)
const anchor = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLDivElement | null>(null)
const rect = reactive({ top: 0, left: 0, minWidth: 176, maxWidth: 384 })

const selectedLabel = computed(() => {
  if (!props.modelValue) {
    return props.emptyLabel
  }
  return props.options.find((o) => o.value === props.modelValue)?.label ?? props.modelValue
})

function panelWidth(): number {
  let cur = anchor.value?.parentElement
  while (cur) {
    if (getComputedStyle(cur).position === 'fixed') {
      break
    }
    cur = cur.parentElement
  }
  if (!cur) {
    return 0
  }
  const panel = cur.firstElementChild as HTMLElement | null
  const width = panel?.getBoundingClientRect().width ?? 0
  return width > 0 ? width : 0
}

function positionMenu() {
  const el = anchor.value
  if (!el) {
    return
  }
  const r = el.getBoundingClientRect()
  const panelW = panelWidth()
  const maxWidth =
    panelW > 0 ? Math.min(panelW, window.innerWidth - 8) : Math.min(384, window.innerWidth - 8)
  const minWidth = Math.min(maxWidth, Math.max(r.width, 176))
  const menuHeight = menu.value?.offsetHeight ?? 240
  let left = r.left
  if (left + maxWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - maxWidth - 8)
  }
  if (left < 8) {
    left = 8
  }
  if (r.bottom + 4 + menuHeight > window.innerHeight - 8) {
    rect.top = Math.max(8, r.top - menuHeight - 4)
  } else {
    rect.top = r.bottom + 4
  }
  rect.left = left
  rect.minWidth = minWidth
  rect.maxWidth = maxWidth
}

function toggle() {
  if (props.disabled) {
    return
  }
  open.value = !open.value
  if (open.value) {
    void nextTick(() => positionMenu())
  }
}

function select(value: string) {
  if (value === props.modelValue && !props.allowEmpty) {
    open.value = false
    return
  }
  emit('update:modelValue', value)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value) {
    return
  }
  const target = e.target as Node
  if (menu.value?.contains(target) || anchor.value?.contains(target)) {
    return
  }
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
  }
}

function onScroll() {
  if (open.value) {
    positionMenu()
  }
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocClick)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('scroll', onScroll, true)
  } else {
    document.removeEventListener('pointerdown', onDocClick)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', onScroll, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div class="relative">
    <button
      ref="anchor"
      type="button"
      class="flex items-center border border-neutral-300 bg-white text-left outline-none focus:border-blue-600 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
      :class="[
        open ? 'border-blue-600 dark:border-blue-400' : '',
        compact ? 'min-h-8 gap-2 px-3' : 'min-h-[2.8rem] gap-[0.6rem] px-4',
      ]"
      :disabled="disabled"
      @click="toggle"
    >
      <span v-if="label" class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{{ label }}</span>
      <span class="truncate text-sm text-neutral-900 dark:text-neutral-100" :title="selectedLabel" :class="valueMaxW">{{ selectedLabel }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        class="fixed z-[60] max-h-60 overflow-y-auto border border-neutral-300 bg-white py-1 shadow-[0_1rem_3rem_rgba(0,0,0,0.22)] dark:border-neutral-700 dark:bg-neutral-900"
        :style="{ top: `${rect.top}px`, left: `${rect.left}px`, minWidth: `${rect.minWidth}px`, maxWidth: `${rect.maxWidth}px` }"
      >
        <button
          v-if="allowEmpty"
          type="button"
          class="flex w-full items-center gap-3 px-6 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          :title="emptyLabel"
          @click="select('')"
        >
          {{ emptyLabel }}
        </button>
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="flex w-full items-center gap-3 px-6 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          :class="{ 'text-blue-700 dark:text-blue-400': option.value === modelValue }"
          @click="select(option.value)"
        >
          <Check
            v-if="option.value === modelValue"
            class="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400"
          />
          <span v-else class="h-4 w-4 shrink-0" />
          <span class="min-w-0 truncate" :title="option.label">{{ option.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>