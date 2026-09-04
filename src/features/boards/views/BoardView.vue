<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRoute, useRouter } from 'vue-router'
import { useWS } from '@/api/ws'
import { getWorkspace } from '@/features/workspaces/api'
import type { Column, Task, TaskPriority, WorkspaceDetail, WorkspaceMember } from '@/shared/types'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import {
  createColumn,
  createTask,
  deleteBoard,
  deleteColumn,
  deleteTask,
  getBoard,
  updateBoard,
  updateColumn,
  updateTask,
} from '../api'
import {
  type ColumnFormValues,
  columnFormSchema,
  type TaskFormValues,
  taskFormSchema,
} from '../schema'

interface DragEndEvent {
  oldIndex: number
  newIndex: number
  from: HTMLElement
  to: HTMLElement
  item: HTMLElement
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ws = useWS()

const workspaceId = computed(() => String(route.params.id))
const boardId = computed(() => String(route.params.boardId))

const board = ref<{ id: string; name: string; workspace_id: string } | null>(null)
const columns = ref<Column[]>([])
const workspace = ref<WorkspaceDetail | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const onlineMembers = ref<string[]>([])
const onlineCount = ref(0)

const actorId = auth.user?.id ?? ''
const canEdit = computed(
  () => workspace.value?.role === 'owner' || workspace.value?.role === 'editor',
)

const memberById = computed(() => {
  const map = new Map<string, WorkspaceMember>()
  for (const m of workspace.value?.members ?? []) {
    map.set(m.id, m)
  }
  return map
})

const boardName = ref('')
const newColumnName = ref('')

const editorOpen = ref(false)
const editingTaskId = ref<string | null>(null)
const taskForm = reactive<TaskFormValues>({
  title: '',
  description: '',
  priority: 'medium',
  assignee_id: '',
  due_date: '',
})
const taskValidation = ref<Partial<Record<keyof TaskFormValues, string>>>({})
const taskColumnId = ref('')

let disposed = false
const unsubscribes: Array<() => void> = []

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const detail = await getBoard(workspaceId.value, boardId.value)
    board.value = { id: detail.id, name: detail.name, workspace_id: detail.workspace_id }
    boardName.value = detail.name
    columns.value = detail.columns
  } catch (e) {
    loadError.value = extractError(e)
    board.value = null
    columns.value = []
  } finally {
    loading.value = false
  }
}

async function loadWorkspace() {
  workspace.value = await getWorkspace(workspaceId.value)
  if (taskForm.assignee_id && !memberById.value.has(taskForm.assignee_id)) {
    taskForm.assignee_id = ''
  }
}

function reload() {
  if (disposed) {
    return
  }
  void load()
}

function handleWsMessage(msg: { type: string; data?: unknown }) {
  if (msg.type === 'presence') {
    const data = msg.data as { members?: string[] } | undefined
    onlineMembers.value = data?.members ?? []
    onlineCount.value = onlineMembers.value.length
    return
  }
  reload()
}

async function onSaveBoard() {
  actionError.value = null
  try {
    await updateBoard(workspaceId.value, boardId.value, { name: boardName.value.trim() })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onAddColumn() {
  const result = columnFormSchema.safeParse({ name: newColumnName.value })
  if (!result.success) {
    actionError.value = extractError(result.error.issues[0])
    return
  }
  actionError.value = null
  try {
    await createColumn(workspaceId.value, boardId.value, result.data)
    newColumnName.value = ''
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onRemoveColumn(column: Column) {
  if (!window.confirm(`Delete column ${column.name} and its tasks?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteColumn(workspaceId.value, boardId.value, column.id)
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function openCreate(columnId: string) {
  editingTaskId.value = null
  taskColumnId.value = columnId
  taskForm.title = ''
  taskForm.description = ''
  taskForm.priority = 'medium'
  taskForm.assignee_id = ''
  taskForm.due_date = ''
  taskValidation.value = {}
  editorOpen.value = true
}

function openEdit(task: Task) {
  editingTaskId.value = task.id
  taskColumnId.value = task.column_id
  taskForm.title = task.title
  taskForm.description = task.description
  taskForm.priority = task.priority
  taskForm.assignee_id = task.assignee?.id ?? ''
  taskForm.due_date = task.due_date?.slice(0, 10) ?? ''
  taskValidation.value = {}
  editorOpen.value = true
}

async function onSaveTask() {
  const result = taskFormSchema.safeParse(taskForm)
  if (!result.success) {
    taskValidation.value = collectErrors(result.error.issues)
    return
  }
  taskValidation.value = {}
  actionError.value = null
  try {
    const payload = result.data
    if (editingTaskId.value) {
      await updateTask(workspaceId.value, boardId.value, editingTaskId.value, {
        ...payload,
        column_id: payload.column_id ?? taskColumnId.value,
        position: undefined,
      })
    } else {
      await createTask(workspaceId.value, boardId.value, {
        ...payload,
        column_id: taskColumnId.value,
      })
    }
    editorOpen.value = false
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onRemoveTask(task: Task) {
  if (!window.confirm(`Delete task ${task.title}?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteTask(workspaceId.value, boardId.value, task.id)
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onDragEnd(evt: DragEndEvent) {
  const targetColumnId = evt.to.dataset.columnId
  const taskId = evt.item.dataset.taskId
  if (!targetColumnId || !taskId) {
    return
  }
  try {
    await updateTask(workspaceId.value, boardId.value, taskId, {
      column_id: targetColumnId,
      position: evt.newIndex,
    })
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    await load()
  }
}

async function onDeleteBoard() {
  if (!window.confirm(`Delete board ${board.value?.name ?? 'this board'}?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteBoard(workspaceId.value, boardId.value)
    await router.push(`/workspaces/${workspaceId.value}`)
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function assigneeLabel(task: Task): string {
  const member = task.assignee
  if (!member) {
    return 'unassigned'
  }
  return member.display_name || member.login
}

function clearTaskError(field: keyof TaskFormValues) {
  if (taskValidation.value[field]) {
    delete taskValidation.value[field]
  }
}

watch(workspaceId, (newWsId, oldWsId) => {
  if (oldWsId) {
    ws.leave(`workspace:${oldWsId}`)
  }
  ws.join(`workspace:${newWsId}`)
})

watch([workspaceId, boardId], () => {
  void Promise.all([load(), loadWorkspace()])
})

onMounted(async () => {
  ws.connect()
  await Promise.all([load(), loadWorkspace()])
  ws.join(`workspace:${workspaceId.value}`)
  for (const type of [
    'presence',
    'board.created',
    'board.updated',
    'board.deleted',
    'column.created',
    'column.updated',
    'column.deleted',
    'task.created',
    'task.updated',
    'task.deleted',
  ]) {
    unsubscribes.push(ws.on(type, handleWsMessage))
  }
})

onUnmounted(() => {
  disposed = true
  ws.leave(`workspace:${workspaceId.value}`)
  for (const unsub of unsubscribes) {
    unsub()
  }
})

const onlineLabel = computed(() => {
  if (onlineCount.value === 0) {
    return 'offline'
  }
  return `${onlineCount.value} online`
})
</script>

<template>
	<div class="px-4 py-6">
		<div class="mx-auto max-w-7xl">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<RouterLink
						:to="`/workspaces/${workspaceId}`"
						class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					>
						Back
					</RouterLink>
					<template v-if="board">
						<input
							v-if="canEdit"
							v-model="boardName"
							type="text"
							class="border border-neutral-300 bg-white px-3 py-2 text-xl text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@change="onSaveBoard"
						/>
						<h1 v-else class="text-xl text-neutral-900 dark:text-neutral-100">{{ board.name }}</h1>
					</template>
				</div>
				<div class="flex items-center gap-3">
					<span class="border border-neutral-300 px-2 py-1 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
						{{ onlineLabel }}
					</span>
					<span v-if="actionError" class="text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</span>
					<button
						v-if="canEdit"
						type="button"
						class="border border-blue-700 px-4 py-2 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
						@click="onDeleteBoard"
					>
						Delete board
					</button>
				</div>
			</div>

			<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>

			<div v-if="!loading && columns.length" class="flex items-start gap-4 overflow-x-auto pb-4">
				<div
					v-for="column in columns"
					:key="column.id"
					class="flex w-72 shrink-0 flex-col border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
				>
					<div class="flex items-center justify-between border-b border-neutral-300 px-3 py-2 dark:border-neutral-700">
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ column.name }}</span>
							<span class="text-xs text-neutral-500 dark:text-neutral-400">{{ column.task_count }}</span>
						</div>
						<button
							v-if="canEdit"
							type="button"
							class="text-neutral-400 hover:text-blue-700 focus:outline-none dark:hover:text-blue-400"
							aria-label="Delete column"
							@click="onRemoveColumn(column)"
						>
							×
						</button>
					</div>

					<VueDraggable
						v-model="column.tasks"
						:group="{ name: 'tasks' }"
						:animation="150"
						ghost-class="opacity-40"
						class="flex min-h-16 flex-col gap-2 p-2"
						:class="{ 'pointer-events-none opacity-50': !canEdit }"
						:data-column-id="column.id"
						@end="onDragEnd"
					>
						<div
							v-for="task in column.tasks"
							:key="task.id"
							:data-task-id="task.id"
							class="group border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-900"
						>
							<div class="flex items-start justify-between gap-2">
								<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ task.title }}</p>
								<span
									class="shrink-0 border px-1 text-xs"
									:class="task.priority === 'high'
										? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400'
										: 'border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400'"
								>
									{{ task.priority }}
								</span>
							</div>
							<p v-if="task.description" class="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
								{{ task.description }}
							</p>
							<div class="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
								<span>{{ assigneeLabel(task) }}</span>
								<span v-if="task.due_date">{{ task.due_date.slice(0, 10) }}</span>
							</div>
							<div v-if="canEdit" class="mt-2 hidden gap-2 group-hover:flex">
								<button
									type="button"
									class="border border-blue-700 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
									@click="openEdit(task)"
								>
									Edit
								</button>
								<button
									type="button"
									class="border border-blue-700 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
									@click="onRemoveTask(task)"
								>
									Delete
								</button>
							</div>
						</div>
					</VueDraggable>

					<button
						v-if="canEdit"
						type="button"
						class="border-t border-neutral-300 px-3 py-2 text-left text-sm text-blue-700 hover:bg-neutral-200 focus:outline-none dark:border-neutral-700 dark:text-blue-400 dark:hover:bg-neutral-700"
						@click="openCreate(column.id)"
					>
						+ Add task
					</button>
				</div>

				<div v-if="canEdit" class="w-72 shrink-0 border border-dashed border-neutral-300 p-3 dark:border-neutral-600">
					<form class="flex flex-col gap-2" novalidate @submit.prevent="onAddColumn">
						<input
							v-model="newColumnName"
							type="text"
							placeholder="Column name"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
						/>
						<button
							type="submit"
							class="bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
						>
							Add column
						</button>
					</form>
				</div>
			</div>

			<div v-if="editorOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" @click.self="editorOpen = false">
				<form class="w-full max-w-md border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900" novalidate @submit.prevent="onSaveTask">
					<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">
						{{ editingTaskId ? 'Edit task' : 'Add task' }}
					</h2>
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-1">
							<label for="task_title" class="text-sm">Title</label>
							<input
								id="task_title"
								v-model="taskForm.title"
								type="text"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearTaskError('title')"
							/>
							<p v-if="taskValidation.title" class="text-sm text-blue-700 dark:text-blue-400">{{ taskValidation.title }}</p>
						</div>
						<div class="flex flex-col gap-1">
							<label for="task_description" class="text-sm">Description</label>
							<textarea
								id="task_description"
								v-model="taskForm.description"
								rows="3"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearTaskError('description')"
							/>
							<p v-if="taskValidation.description" class="text-sm text-blue-700 dark:text-blue-400">{{ taskValidation.description }}</p>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div class="flex flex-col gap-1">
								<label for="task_priority" class="text-sm">Priority</label>
								<select
									id="task_priority"
									v-model="taskForm.priority"
									class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								>
									<option value="low">low</option>
									<option value="medium">medium</option>
									<option value="high">high</option>
								</select>
							</div>
							<div class="flex flex-col gap-1">
								<label for="task_assignee" class="text-sm">Assignee</label>
								<select
									id="task_assignee"
									v-model="taskForm.assignee_id"
									class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								>
									<option value="">unassigned</option>
									<option v-for="m in workspace?.members ?? []" :key="m.id" :value="m.id">
										{{ m.display_name }} ({{ m.login }})
									</option>
								</select>
							</div>
						</div>
						<div class="flex flex-col gap-1">
							<label for="task_due_date" class="text-sm">Due date</label>
							<input
								id="task_due_date"
								v-model="taskForm.due_date"
								type="date"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearTaskError('due_date')"
							/>
							<p v-if="taskValidation.due_date" class="text-sm text-blue-700 dark:text-blue-400">{{ taskValidation.due_date }}</p>
						</div>
						<div class="flex items-center justify-end gap-2">
							<button
								type="button"
								class="border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
								@click="editorOpen = false"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
							>
								{{ editingTaskId ? 'Save' : 'Create' }}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</template>