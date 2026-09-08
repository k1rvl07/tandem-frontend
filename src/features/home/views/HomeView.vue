<script setup lang="ts">
import { Flame, Palette, User, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWS } from '@/api/ws'
import {
  addWorkspaceFavorite,
  createWorkspace,
  listWorkspaces,
  removeWorkspaceFavorite,
} from '@/features/workspaces/api'
import { type WorkspaceFormValues, workspaceFormSchema } from '@/features/workspaces/schema'
import { ACCENT_PRESETS, DEFAULT_ACCENT, useTheme } from '@/shared/composables/useTheme'
import type { Board, Task, TaskTreeQuery, TreeWorkspace, Workspace } from '@/shared/types'
import ProfileMenu from '@/shared/ui/ProfileMenu.vue'
import SignedImage from '@/shared/ui/SignedImage.vue'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { getTaskTree } from '../api/tree'

const router = useRouter()

const { isDark, accent: themeAccent, setAccent } = useTheme()

const themeOpen = ref(false)

const workspaces = ref<Workspace[]>([])
const tree = ref<TreeWorkspace[]>([])
const tasksOpen = ref(false)
const taskFilter = ref<'all' | 'mine' | 'for_me'>('all')
const scopeFilter = ref<'ws_fav' | 'board_fav' | 'all'>('all')
const treeLoading = ref(false)
const loading = ref(false)
const loadError = ref<string | null>(null)
const toggling = ref<Record<string, boolean>>({})

const creating = ref(false)
const createOpen = ref(false)
const createError = ref<string | null>(null)
const createValues = ref<WorkspaceFormValues>({ name: '', description: '' })
const createValidation = ref<Partial<Record<keyof WorkspaceFormValues, string>>>({})

const ws = useWS()
const realtimeEvents: string[] = [
  'task.created',
  'task.updated',
  'task.deleted',
  'workspace.updated',
  'board.created',
  'board.updated',
  'board.deleted',
  'boards.reordered',
  'favorites.updated',
]
const joinedRooms = new Set<string>()
const unsubscribes: Array<() => void> = []
let realtimeTimer: number | null = null
let disposed = false

const sortedWorkspaces = computed(() =>
  [...workspaces.value].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite)),
)

const favoriteCount = computed(() => workspaces.value.filter((w) => w.is_favorite).length)

const boardFilterOptions: Array<{ label: string; value: 'ws_fav' | 'board_fav' | 'all' }> = [
  { label: 'Featured workspace tasks', value: 'ws_fav' },
  { label: 'Featured board tasks', value: 'board_fav' },
  { label: 'All', value: 'all' },
]

const taskFilterOptions: Array<{ label: string; value: 'all' | 'mine' | 'for_me' }> = [
  { label: 'Mine', value: 'mine' },
  { label: 'For me', value: 'for_me' },
  { label: 'All', value: 'all' },
]

function tabClass(value: string, active: string): string {
  return active === value
    ? 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900'
    : 'bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
}

function accent(ws: Workspace): string {
  return ws.theme ? `#${ws.theme}` : DEFAULT_ACCENT
}

function openWorkspace(id: string) {
  router.push(`/workspaces/${id}`)
}

function openTask(workspaceId: string, task: Task) {
  router.push(`/workspaces/${workspaceId}?board=${task.board_id}&task=${task.id}`)
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-menu="theme"]')) themeOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  ws.connect()
  load().then(() => {
    if (disposed) return
    for (const type of realtimeEvents) {
      unsubscribes.push(ws.on(type, (msg) => onRealtimeEvent(msg.type)))
    }
    reconcileRooms()
  })
})

onUnmounted(() => {
  disposed = true
  document.removeEventListener('click', onDocumentClick)
  for (const unsubscribe of unsubscribes) {
    unsubscribe()
  }
  unsubscribes.length = 0
  for (const room of joinedRooms) {
    ws.leave(room)
  }
  joinedRooms.clear()
  if (realtimeTimer !== null) {
    window.clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    workspaces.value = await listWorkspaces()
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    loading.value = false
  }
}

function reconcileRooms() {
  const wanted = new Set(workspaces.value.map((w) => `workspace:${w.id}`))
  for (const room of wanted) {
    if (!joinedRooms.has(room)) {
      joinedRooms.add(room)
      ws.join(room)
    }
  }
  for (const room of joinedRooms) {
    if (!wanted.has(room)) {
      joinedRooms.delete(room)
      ws.leave(room)
    }
  }
}

function onRealtimeEvent(_type: string) {
  if (realtimeTimer !== null) {
    window.clearTimeout(realtimeTimer)
  }
  realtimeTimer = window.setTimeout(() => {
    realtimeTimer = null
    if (disposed) return
    void load().then(() => {
      if (disposed) return
      reconcileRooms()
      if (tasksOpen.value) {
        void loadTree(true)
      }
    })
  }, 400)
}

watch(ws.connected, (connected: boolean) => {
  if (!connected || disposed) return
  void load().then(() => {
    if (disposed) return
    reconcileRooms()
    if (tasksOpen.value) {
      void loadTree(true)
    }
  })
})

let treeSeq = 0

async function loadTree(quiet = false) {
  const seq = ++treeSeq
  if (!quiet) {
    treeLoading.value = true
  }
  try {
    const query: TaskTreeQuery = { tasks: taskFilter.value }
    if (scopeFilter.value === 'ws_fav') {
      query.workspaces = 'fav'
    } else if (scopeFilter.value === 'board_fav') {
      query.boards = 'fav'
    }
    const result = await getTaskTree(query)
    if (seq !== treeSeq) return
    tree.value = result
  } catch (e) {
    if (!quiet && seq === treeSeq) {
      loadError.value = extractError(e)
    }
  } finally {
    if (seq === treeSeq) {
      treeLoading.value = false
    }
  }
}

function openTasks() {
  tasksOpen.value = true
  void loadTree()
}

function selectTaskFilter(value: 'all' | 'mine' | 'for_me') {
  taskFilter.value = value
  void loadTree()
}

function selectBoardFilter(value: 'ws_fav' | 'board_fav' | 'all') {
  scopeFilter.value = value
  void loadTree()
}

async function toggleFavorite(ws: Workspace) {
  if (toggling.value[ws.id]) return
  toggling.value[ws.id] = true
  try {
    if (ws.is_favorite) {
      await removeWorkspaceFavorite(ws.id)
      ws.is_favorite = false
    } else {
      await addWorkspaceFavorite(ws.id)
      ws.is_favorite = true
    }
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    toggling.value[ws.id] = false
  }
}

function openCreate() {
  createValues.value = { name: '', description: '', prefix: '' }
  createValidation.value = {}
  createError.value = null
  createOpen.value = true
}

async function onCreate() {
  const result = workspaceFormSchema.safeParse(createValues.value)
  if (!result.success) {
    createValidation.value = collectErrors(result.error.issues)
    return
  }
  createValidation.value = {}
  createError.value = null
  creating.value = true
  try {
    const ws = await createWorkspace(result.data)
    createOpen.value = false
    workspaces.value.push(ws)
  } catch (e) {
    createError.value = extractError(e)
  } finally {
    creating.value = false
  }
}

function clearCreateError(field: keyof WorkspaceFormValues) {
  if (createValidation.value[field]) {
    delete createValidation.value[field]
  }
}
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<div class="border-b border-neutral-300 dark:border-neutral-700">
<div class="px-3 sm:px-4 md:px-6">
				<div class="flex items-center py-2">
					<div class="flex w-1/3 items-center justify-start">
						<button
							type="button"
							class="border border-neutral-300 bg-white px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
							@click="openTasks"
						>
							My tasks
						</button>
					</div>

					<div class="flex w-1/3 items-center justify-center">
						<span class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Tandem</span>
					</div>

					<div class="flex w-1/3 items-center justify-end gap-3">
						<div data-menu="theme" class="relative">
							<button
								type="button"
								aria-label="Theme settings"
								class="flex h-9 w-9 items-center justify-center border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
								@click="themeOpen = !themeOpen"
							>
								<Palette :size="18" />
							</button>
							<div
								v-if="themeOpen"
								class="absolute right-0 top-full z-10 mt-1 w-64 border border-neutral-300 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
							>
								<p class="mb-2 text-xs uppercase text-neutral-600 dark:text-neutral-400">Theme</p>
								<div class="flex border border-neutral-300 dark:border-neutral-600">
									<button
										type="button"
										class="flex-1 px-3 py-1.5 text-sm focus:outline-none"
										:class="!isDark ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'"
										@click="isDark = false"
									>
										Light
									</button>
									<button
										type="button"
										class="flex-1 border-l border-neutral-300 px-3 py-1.5 text-sm focus:outline-none dark:border-neutral-600"
										:class="isDark ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'"
										@click="isDark = true"
									>
										Dark
									</button>
								</div>
								<p class="mb-2 mt-3 text-xs uppercase text-neutral-600 dark:text-neutral-400">Accent color</p>
								<div class="flex flex-wrap gap-2">
									<button
										v-for="color in ACCENT_PRESETS"
										:key="color"
										type="button"
										class="flex h-8 w-8 items-center justify-center border border-neutral-300 focus:outline-none dark:border-neutral-600"
										:style="{ backgroundColor: color }"
										:aria-label="`Accent ${color}`"
										@click="setAccent(color)"
									>
										<span v-if="themeAccent.toLowerCase() === color.toLowerCase()" class="text-sm font-semibold text-white">✓</span>
									</button>
								</div>
							</div>
						</div>

						<ProfileMenu with-name />
					</div>
				</div>
			</div>
		</div>

<main class="flex-1 px-3 py-4 sm:px-4 md:px-6">
			<div class="mb-5 flex items-center">
				<div class="flex w-1/3 items-center justify-start"></div>
				<div class="flex w-1/3 items-center justify-center">
					<h1 class="text-xl text-neutral-900 dark:text-neutral-100">All workspaces</h1>
				</div>
				<div class="flex w-1/3 items-center justify-end">
					<button
						type="button"
						class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
						@click="openCreate"
					>
						Create workspace
					</button>
				</div>
			</div>

			<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
			<p v-if="loading && workspaces.length === 0" class="text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>

			<div class="flex flex-wrap gap-4">
				<div
					v-for="ws in sortedWorkspaces"
					:key="ws.id"
					class="flex w-64 flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
				>
					<div class="flex items-center justify-between gap-2 border-b border-neutral-300 px-3 py-2 dark:border-neutral-700">
						<span class="min-w-0 truncate font-medium text-neutral-900 dark:text-neutral-100" :title="ws.name">
							{{ ws.name }}
						</span>
						<button
							type="button"
							class="flex h-6 w-6 shrink-0 items-center justify-center text-lg focus:outline-none"
							:class="ws.is_favorite ? 'text-blue-700 dark:text-blue-400' : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300'"
							:aria-label="ws.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
							:disabled="toggling[ws.id]"
							@click="toggleFavorite(ws)"
						>
							{{ ws.is_favorite ? '★' : '☆' }}
						</button>
					</div>
					<button
						type="button"
						class="flex flex-1 flex-col items-start gap-2 p-3 text-left focus:outline-none"
						@click="openWorkspace(ws.id)"
					>
						<div class="mt-auto flex w-full items-center justify-between gap-2">
							<span class="flex min-w-0 items-center gap-2">
								<span class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800">
									<SignedImage
										v-if="ws.owner?.avatar_key"
										:src="ws.owner.avatar_key"
										alt="owner"
										class="h-full w-full object-cover"
									/>
									<User v-else :size="14" class="shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
								</span>
								<span class="min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300">
									{{ ws.owner?.display_name || ws.owner?.login || 'Owner' }}
								</span>
							</span>
							<span
								class="flex h-6 shrink-0 items-center justify-center px-2 text-sm font-medium text-white"
								:style="{ backgroundColor: accent(ws) }"
							>
								{{ ws.prefix || 'WS' }}
							</span>
						</div>
					</button>
				</div>
			</div>
		</main>

		<div
			v-if="tasksOpen"
			class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"
			@click.self="tasksOpen = false"
		>
			<div class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
				<div class="flex items-center justify-between border-b border-neutral-300 px-6 py-3 dark:border-neutral-700">
					<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">My tasks</span>
					<button
						type="button"
						aria-label="Close my tasks"
						class="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
						@click="tasksOpen = false"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
				<div class="flex flex-col items-center gap-2 border-b border-neutral-300 px-6 py-4 dark:border-neutral-700">
					<div class="flex w-fit border border-neutral-300 dark:border-neutral-600">
						<button
							v-for="opt in boardFilterOptions"
							:key="opt.value"
							type="button"
							class="border-l border-neutral-300 px-3 py-1.5 text-sm first:border-l-0 focus:outline-none dark:border-neutral-600"
							:class="tabClass(opt.value, scopeFilter)"
							@click="selectBoardFilter(opt.value)"
						>
							{{ opt.label }}
						</button>
					</div>
					<div class="flex w-fit border border-neutral-300 dark:border-neutral-600">
						<button
							v-for="opt in taskFilterOptions"
							:key="opt.value"
							type="button"
							class="border-l border-neutral-300 px-3 py-1.5 text-sm first:border-l-0 focus:outline-none dark:border-neutral-600"
							:class="tabClass(opt.value, taskFilter)"
							@click="selectTaskFilter(opt.value)"
						>
							{{ opt.label }}
						</button>
					</div>
				</div>
				<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
					<p v-if="treeLoading" class="p-2 text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>
					<p v-else-if="tree.length === 0" class="p-2 text-sm text-neutral-600 dark:text-neutral-400">No tasks.</p>
					<template v-else>
						<div v-for="group in tree" :key="group.workspace.id" class="mb-5 last:mb-0">
							<p class="px-1 pb-1 text-xs uppercase text-neutral-600 dark:text-neutral-400">{{ group.workspace.name }}</p>
							<div v-for="tb in group.boards" :key="tb.board.id" class="mb-3">
								<p class="flex items-center gap-2 px-1 pb-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
									<span
										class="h-1.5 w-1.5 shrink-0"
										:style="{ backgroundColor: accent(group.workspace) || 'currentColor' }"
									/>
									<span class="min-w-0 truncate" :title="tb.board.name">{{ tb.board.name }}</span>
								</p>
								<ul class="flex flex-col">
									<li v-for="t in tb.tasks" :key="t.id">
										<button
											type="button"
											class="flex w-full items-center gap-2 border-b border-neutral-200 px-2 py-1.5 text-left text-sm hover:bg-neutral-100 focus:outline-none dark:border-neutral-700 dark:hover:bg-neutral-800"
											:class="{ 'opacity-60': t.is_hidden }"
											@click="tasksOpen = false; openTask(group.workspace.id, t)"
										>
											<Flame
												v-if="t.is_urgent"
												:size="12"
												class="shrink-0"
												:style="{ color: accent(group.workspace) || 'currentColor' }"
												aria-hidden="true"
											/>
											<span class="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{{ t.display_id }}</span>
											<span class="line-clamp-1 break-words text-neutral-600 dark:text-neutral-300" :class="t.is_hidden ? 'line-through' : ''">{{ t.title }}</span>
											<span class="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{{ t.column_name }}</span>
										</button>
									</li>
								</ul>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>

		<div v-if="createOpen" class="fixed inset-0 z-20 flex items-center justify-center bg-neutral-950/40">
			<div class="w-full max-w-sm border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Create workspace</h2>
				<form class="flex flex-col gap-4" novalidate @submit.prevent="onCreate">
					<div class="flex flex-col gap-1">
						<label for="ws_name" class="text-sm">Name</label>
						<input
							id="ws_name"
							v-model="createValues.name"
							type="text"
							maxlength="80"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearCreateError('name')"
						/>
						<p v-if="createValidation.name" class="text-sm text-blue-700 dark:text-blue-400">{{ createValidation.name }}</p>
					</div>
					<div class="flex flex-col gap-1">
						<label for="ws_prefix" class="text-sm">Prefix (optional)</label>
						<input
							id="ws_prefix"
							v-model="createValues.prefix"
							type="text"
							placeholder="Auto"
							autocomplete="off"
							maxlength="10"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearCreateError('prefix')"
						/>
						<p v-if="createValidation.prefix" class="text-sm text-blue-700 dark:text-blue-400">{{ createValidation.prefix }}</p>
					</div>
					<div class="flex flex-col gap-1">
						<label for="ws_desc" class="text-sm">Description</label>
						<textarea
							id="ws_desc"
							v-model="createValues.description"
							v-autosize
							rows="2"
							maxlength="400"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearCreateError('description')"
						/>
						<p v-if="createValidation.description" class="text-sm text-blue-700 dark:text-blue-400">{{ createValidation.description }}</p>
					</div>
					<p v-if="createError" class="text-sm text-blue-700 dark:text-blue-400">{{ createError }}</p>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
							@click="createOpen = false"
						>
							Cancel
						</button>
						<button
							type="submit"
							:disabled="creating"
							class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
						>
							{{ creating ? 'Creating...' : 'Create' }}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</template>
