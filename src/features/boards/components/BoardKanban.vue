<script setup lang="ts">
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File,
  Flame,
  ImagePlus,
  MoreHorizontal,
  Plus,
  User,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { imageUrl, uploadImage } from '@/api/files'
import { http } from '@/api/http'
import { useWS } from '@/api/ws'
import { getWorkspace } from '@/features/workspaces/api'
import type {
  Board,
  Column,
  Task,
  TaskAttachment,
  TaskDetail,
  WorkspaceDetail,
  WorkspaceMember,
} from '@/shared/types'
import TagCheck from '@/shared/ui/TagCheck.vue'
import TagSelect from '@/shared/ui/TagSelect.vue'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import {
  createAttachment,
  createTask,
  deleteAttachment,
  getBoard,
  getTaskDetail,
  listAttachments,
  listBoards,
  listWorkspaceTasks,
  updateTask,
} from '../api'
import { type TaskFormValues, taskFormSchema } from '../schema'

const props = defineProps<{
  workspaceId: string
  boardId: string | null
  myTasks?: boolean
  assigneeId?: string
  noAssignee?: boolean
}>()

const emit = defineEmits<(e: 'task-counts', counts: Record<string, number>) => void>()

interface DragEndEvent {
  oldIndex: number
  newIndex: number
  from: HTMLElement
  to: HTMLElement
  item: HTMLElement
}

const auth = useAuthStore()
const ws = useWS()

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
  () =>
    workspace.value?.role === 'owner' ||
    workspace.value?.role === 'editor' ||
    workspace.value?.role === 'viewer',
)

const memberById = computed(() => {
  const map = new Map<string, WorkspaceMember>()
  for (const m of workspace.value?.members ?? []) {
    map.set(m.id, m)
  }
  return map
})

const filteredColumns = computed(() => {
  const myTasksOn = props.myTasks === true
  const noAssigneeOn = props.noAssignee === true
  const assigneeFilter = props.assigneeId ?? ''
  return columns.value.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task) => {
      const taskAssigneeId = task.assignee?.id ?? ''
      if (myTasksOn && taskAssigneeId !== actorId) {
        return false
      }
      if (assigneeFilter && noAssigneeOn) {
        return taskAssigneeId === assigneeFilter || task.assignee == null
      }
      if (assigneeFilter && taskAssigneeId !== assigneeFilter) {
        return false
      }
      if (noAssigneeOn && task.assignee != null) {
        return false
      }
      return true
    }),
  }))
})

const childrenByParent = computed(() => {
  const map = new Map<string, Task[]>()
  for (const t of workspaceTasks.value) {
    if (!t.parent_id || t.archived_at != null) {
      continue
    }
    const list = map.get(t.parent_id) ?? []
    list.push(t)
    map.set(t.parent_id, list)
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        a.board_name.localeCompare(b.board_name) ||
        boardColumnIndex(a.board_id, a.column_id) - boardColumnIndex(b.board_id, b.column_id) ||
        (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0) ||
        b.created_at.localeCompare(a.created_at),
    )
  }
  return map
})

function columnsOf(boardId: string): Column[] {
  if (boardId === props.boardId) {
    return columns.value
  }
  return columnsByBoard.value[boardId] ?? []
}

function boardColumnIndex(boardId: string, columnId: string): number {
  return columnsOf(boardId).findIndex((c) => c.id === columnId)
}

function boardColumnCount(boardId: string): number {
  return columnsOf(boardId).length
}

function columnChipClass(boardId: string, columnId: string): string {
  const base =
    'shrink-0 px-1 text-[10px] uppercase tracking-wide border border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400'
  const count = boardColumnCount(boardId)
  const idx = boardColumnIndex(boardId, columnId)
  if (count > 0 && idx === count - 1) {
    return 'shrink-0 text-[10px] uppercase tracking-wide bg-blue-700 dark:bg-blue-400 text-white'
  }
  return base
}

function subtaskProgressClass(boardId: string, columnId: string, index: number): string {
  const current = boardColumnIndex(boardId, columnId)
  if (index < current) {
    return 'border-r border-neutral-200 bg-blue-700/40 dark:border-neutral-700 dark:bg-blue-400/40'
  }
  if (index === current) {
    return 'bg-blue-700 dark:bg-blue-400'
  }
  return 'border-r border-neutral-200 dark:border-neutral-700'
}

const boardName = ref('')

const editorOpen = ref(false)
const editingTaskId = ref<string | null>(null)
const taskForm = reactive<TaskFormValues>({
  title: '',
  description: '',
  assignee_id: '',
  curator_id: '',
  parent_id: '',
  board_id: '',
  column_id: '',
  is_urgent: false,
  is_hidden: false,
  due_date: '',
  image_key: '',
})
const taskValidation = ref<Partial<Record<keyof TaskFormValues, string>>>({})
const taskColumnId = ref('')
const currentBoardId = ref('')
const taskDetail = ref<TaskDetail | null>(null)
const boards = ref<Board[]>([])
const columnsByBoard = ref<Record<string, Column[]>>({})
const columnOptions = ref<Column[]>([])
const parentOptions = ref<Task[]>([])
const attachments = ref<TaskAttachment[]>([])
const attachmentBlobs = reactive<Record<string, string>>({})
const workspaceTasks = ref<Task[]>([])

function revokeAttachmentBlobs() {
  for (const url of Object.values(attachmentBlobs)) {
    URL.revokeObjectURL(url)
  }
  for (const key of Object.keys(attachmentBlobs)) {
    delete attachmentBlobs[key]
  }
}

async function hydrateAttachmentBlobs(list: TaskAttachment[]) {
  await Promise.all(
    list.map(async (a) => {
      if (attachmentBlobs[a.id]) {
        return
      }
      try {
        const path = a.url.startsWith('/api/v1') ? a.url.slice('/api/v1'.length) : a.url
        const res = await http.get(path, { responseType: 'blob' })
        attachmentBlobs[a.id] = URL.createObjectURL(res.data)
      } catch {
        delete attachmentBlobs[a.id]
      }
    }),
  )
}
const menuOpen = ref(false)
const taskMenu = ref<HTMLDivElement | null>(null)
const taskMenuAnchor = ref<HTMLButtonElement | null>(null)
const attachmentUploading = ref(false)
const attachmentInput = ref<HTMLInputElement | null>(null)
const coverUploading = ref(false)
const coverInput = ref<HTMLInputElement | null>(null)

const boardOptions = computed(() => boards.value.map((b) => ({ label: b.name, value: b.id })))
const columnOptionList = computed(() =>
  columnOptions.value.map((c) => ({ label: c.name, value: c.id })),
)
const memberOptions = computed(() =>
  (workspace.value?.members ?? []).map((m) => ({
    label: `${m.display_name} (${m.login})`,
    value: m.id,
  })),
)
const parentOptionList = computed(() =>
  parentOptions.value.map((t) => ({ label: `${t.display_id} — ${t.title}`, value: t.id })),
)

const dueOpen = ref(false)
const dueDraft = ref('')
const dueAnchor = ref<HTMLButtonElement | null>(null)
const dueMenu = ref<HTMLDivElement | null>(null)
const dueRect = reactive({ top: 0, left: 0 })

const dueLabel = computed(() => (taskForm.due_date ? taskForm.due_date : ''))

const dueMonth = reactive({ year: new Date().getFullYear(), month: new Date().getMonth() })
const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function dueDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const dueMonthLabel = computed(() =>
  new Date(dueMonth.year, dueMonth.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  }),
)

interface DueCell {
  dateStr: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const dueCells = computed<DueCell[]>(() => {
  const daysInMonth = new Date(dueMonth.year, dueMonth.month + 1, 0).getDate()
  const prevDays = new Date(dueMonth.year, dueMonth.month, 0).getDate()
  const offset = (new Date(dueMonth.year, dueMonth.month, 1).getDay() + 6) % 7
  const now = new Date()
  const todayStr = dueDateStr(now.getFullYear(), now.getMonth(), now.getDate())
  const cells: DueCell[] = []
  for (let i = 0; i < 42; i++) {
    const day = i - offset + 1
    let inMonth = day >= 1 && day <= daysInMonth
    const dateStr = inMonth
      ? dueDateStr(dueMonth.year, dueMonth.month, day)
      : day < 1
        ? dueDateStr(
            dueMonth.month === 0 ? dueMonth.year - 1 : dueMonth.year,
            dueMonth.month === 0 ? 11 : dueMonth.month - 1,
            prevDays + day,
          )
        : dueDateStr(
            dueMonth.month === 11 ? dueMonth.year + 1 : dueMonth.year,
            dueMonth.month === 11 ? 0 : dueMonth.month + 1,
            day - daysInMonth,
          )
    cells.push({
      dateStr,
      day: inMonth ? day : day < 1 ? prevDays + day : day - daysInMonth,
      inMonth,
      isToday: inMonth && dateStr === todayStr,
      isSelected: dueDraft.value === dateStr,
    })
  }
  return cells
})

function dueCellClass(cell: DueCell): string {
  if (cell.isSelected) {
    return 'bg-blue-700 text-white dark:bg-blue-500 dark:text-neutral-900'
  }
  if (cell.isToday) {
    return 'border border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400'
  }
  if (cell.inMonth) {
    return 'border border-transparent text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800'
  }
  return 'border border-transparent text-neutral-400 dark:text-neutral-600'
}

function duePrevMonth() {
  dueMonth.month -= 1
  if (dueMonth.month < 0) {
    dueMonth.month = 11
    dueMonth.year -= 1
  }
}

function dueNextMonth() {
  dueMonth.month += 1
  if (dueMonth.month > 11) {
    dueMonth.month = 0
    dueMonth.year += 1
  }
}

function pickDueDate(dateStr: string) {
  dueDraft.value = dateStr
  clearTaskError('due_date')
}

function positionDuePopup() {
  const el = dueAnchor.value
  if (!el) {
    return
  }
  const r = el.getBoundingClientRect()
  dueRect.top = r.bottom + 4
  dueRect.left = r.left
}

function openDuePopup() {
  const el = dueAnchor.value
  if (!el) {
    return
  }
  dueDraft.value = taskForm.due_date
  if (dueDraft.value) {
    dueMonth.year = Number(dueDraft.value.slice(0, 4))
    dueMonth.month = Number(dueDraft.value.slice(5, 7)) - 1
  } else {
    const now = new Date()
    dueMonth.year = now.getFullYear()
    dueMonth.month = now.getMonth()
  }
  positionDuePopup()
  dueOpen.value = true
}

function saveDueDate() {
  if (dueDraft.value) {
    taskForm.due_date = dueDraft.value
    clearTaskError('due_date')
  }
  dueOpen.value = false
}

function clearDueDate() {
  dueDraft.value = ''
  taskForm.due_date = ''
  clearTaskError('due_date')
  dueOpen.value = false
}

function onDueDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (dueMenu.value?.contains(target) || dueAnchor.value?.contains(target)) {
    return
  }
  dueOpen.value = false
}

function onDueKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dueOpen.value = false
  }
}

watch(dueOpen, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDueDocClick)
    document.addEventListener('keydown', onDueKeydown)
    window.addEventListener('scroll', positionDuePopup, true)
  } else {
    document.removeEventListener('pointerdown', onDueDocClick)
    document.removeEventListener('keydown', onDueKeydown)
    window.removeEventListener('scroll', positionDuePopup, true)
  }
})

function onTaskMenuDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (taskMenu.value?.contains(target) || taskMenuAnchor.value?.contains(target)) {
    return
  }
  menuOpen.value = false
}

function onTaskMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false
  }
}

watch(menuOpen, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onTaskMenuDocClick)
    document.addEventListener('keydown', onTaskMenuKeydown)
  } else {
    document.removeEventListener('pointerdown', onTaskMenuDocClick)
    document.removeEventListener('keydown', onTaskMenuKeydown)
  }
})

let disposed = false
const unsubscribes: Array<() => void> = []

function boardTaskCount(): Record<string, number> {
  const boardId = props.boardId
  if (!boardId) {
    return {}
  }
  return {
    [boardId]: columns.value.reduce((sum, col) => sum + col.tasks.length, 0),
  }
}

function insertTask(tasks: Task[], task: Task) {
  const idx = Math.max(0, Math.min(task.position, tasks.length))
  tasks.splice(idx, 0, task)
}

function applyCreated(task: Task) {
  if (workspaceTasks.value.some((t) => t.id === task.id)) {
    applyUpdated(task)
    return
  }
  workspaceTasks.value.push(task)
  if (task.board_id !== props.boardId) {
    void ensureBoardColumns(task.board_id)
    return
  }
  const col = columns.value.find((c) => c.id === task.column_id)
  if (col) {
    insertTask(col.tasks, task)
    col.task_count = col.tasks.length
  }
  emit('task-counts', boardTaskCount())
}

function applyUpdated(task: Task) {
  const wsIdx = workspaceTasks.value.findIndex((t) => t.id === task.id)
  if (wsIdx >= 0) {
    workspaceTasks.value.splice(wsIdx, 1, task)
  } else {
    workspaceTasks.value.push(task)
  }
  for (const col of columns.value) {
    const i = col.tasks.findIndex((t) => t.id === task.id)
    if (i >= 0) {
      col.tasks.splice(i, 1)
      break
    }
  }
  syncColumnCounts()
  if (task.board_id !== props.boardId) {
    void ensureBoardColumns(task.board_id)
    emit('task-counts', boardTaskCount())
    return
  }
  if (task.archived_at) {
    emit('task-counts', boardTaskCount())
    return
  }
  const col = columns.value.find((c) => c.id === task.column_id)
  if (col && !col.tasks.some((t) => t.id === task.id)) {
    insertTask(col.tasks, task)
    syncColumnCounts()
  }
  emit('task-counts', boardTaskCount())
}

function syncColumnCounts() {
  for (const col of columns.value) {
    col.task_count = col.tasks.length
  }
}

function applyDeleted(id: string) {
  const wsIdx = workspaceTasks.value.findIndex((t) => t.id === id)
  if (wsIdx >= 0) {
    workspaceTasks.value.splice(wsIdx, 1)
  }
  for (const col of columns.value) {
    const i = col.tasks.findIndex((t) => t.id === id)
    if (i >= 0) {
      col.tasks.splice(i, 1)
      col.task_count = col.tasks.length
      break
    }
  }
  emit('task-counts', boardTaskCount())
}

async function load() {
  if (!props.boardId || disposed) {
    board.value = null
    columns.value = []
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const [detail, tasks] = await Promise.all([
      getBoard(props.workspaceId, props.boardId),
      listWorkspaceTasks(props.workspaceId),
    ])
    board.value = { id: detail.id, name: detail.name, workspace_id: detail.workspace_id }
    boardName.value = detail.name
    columns.value = detail.columns
    workspaceTasks.value = tasks
    for (const id of new Set(tasks.map((t) => t.board_id).filter(Boolean))) {
      void ensureBoardColumns(id)
    }
    emit('task-counts', boardTaskCount())
  } catch (e) {
    loadError.value = extractError(e)
    board.value = null
    columns.value = []
  } finally {
    loading.value = false
  }
}

async function loadWorkspace() {
  if (disposed) {
    return
  }
  workspace.value = await getWorkspace(props.workspaceId)
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

async function ensureBoardColumns(boardId: string) {
  if (!boardId || boardId === props.boardId || disposed || columnsByBoard.value[boardId]) {
    return
  }
  try {
    const detail = await getBoard(props.workspaceId, boardId)
    if (!disposed) {
      columnsByBoard.value[boardId] = detail.columns
    }
  } catch {
    columnsByBoard.value[boardId] = []
  }
}

function handleWsMessage(msg: { type: string; data?: unknown }) {
  if (msg.type === 'presence') {
    const data = msg.data as { members?: string[] } | undefined
    onlineMembers.value = data?.members ?? []
    onlineCount.value = onlineMembers.value.length
    return
  }
  if (msg.type === 'board.deleted' || msg.type === 'board.updated') {
    reload()
    return
  }
  if (msg.type === 'workspace.updated') {
    void loadWorkspace()
    return
  }
  if (msg.type === 'task.created') {
    applyCreated(msg.data as Task)
    return
  }
  if (msg.type === 'task.updated') {
    const task = msg.data as Task
    applyUpdated(task)
    if (editorOpen.value && editingTaskId.value === task.id) {
      void refreshOpenEditor(task.id)
    }
    return
  }
  if (msg.type === 'task.deleted') {
    const data = msg.data as { id?: string } | undefined
    if (data?.id) {
      applyDeleted(data.id)
    }
    return
  }
  if (msg.type === 'attachment.created') {
    const data = msg.data as TaskAttachment | undefined
    if (
      data?.id &&
      editorOpen.value &&
      editingTaskId.value === data.task_id &&
      !attachments.value.some((a) => a.id === data.id)
    ) {
      attachments.value.push(data)
      void hydrateAttachmentBlobs([data])
    }
    return
  }
  if (msg.type === 'attachment.deleted') {
    const data = msg.data as { id?: string } | undefined
    if (data?.id && editorOpen.value) {
      const prev = attachments.value.length
      attachments.value = attachments.value.filter((a) => a.id !== data.id)
      if (prev !== attachments.value.length && attachmentBlobs[data.id]) {
        URL.revokeObjectURL(attachmentBlobs[data.id])
        delete attachmentBlobs[data.id]
      }
    }
    return
  }
}

function resetForm() {
  taskForm.title = ''
  taskForm.description = ''
  taskForm.assignee_id = ''
  taskForm.curator_id = ''
  taskForm.parent_id = ''
  taskForm.board_id = props.boardId ?? ''
  taskForm.column_id = ''
  taskForm.is_urgent = false
  taskForm.is_hidden = false
  taskForm.due_date = ''
  taskForm.image_key = ''
  taskValidation.value = {}
}

async function loadBoardColumns(boardId: string) {
  if (!boardId) {
    columnOptions.value = []
    return
  }
  try {
    const detail = await getBoard(props.workspaceId, boardId)
    columnOptions.value = detail.columns
  } catch {
    columnOptions.value = []
  }
}

async function loadBoards() {
  try {
    boards.value = await listBoards(props.workspaceId)
  } catch {
    boards.value = []
  }
}

async function openCreate(columnId?: string) {
  editingTaskId.value = null
  taskDetail.value = null
  currentBoardId.value = props.boardId ?? ''
  attachments.value = []
  menuOpen.value = false
  resetForm()
  await Promise.all([loadBoards(), loadBoardColumns(taskForm.board_id), loadParentOptions(null)])
  taskForm.column_id = columnId ?? columnOptions.value[0]?.id ?? ''
  editorOpen.value = true
}

defineExpose({ openCreate })

async function openEdit(task: { id: string }) {
  attachments.value = []
  menuOpen.value = false
  taskValidation.value = {}
  try {
    const detail = await getTaskDetail(props.workspaceId, task.id)
    editingTaskId.value = task.id
    taskDetail.value = detail
    currentBoardId.value = detail.board_id
    taskForm.board_id = detail.board_id
    taskForm.column_id = detail.column_id
    taskForm.title = detail.title
    taskForm.description = detail.description
    taskForm.assignee_id = detail.assignee?.id ?? ''
    taskForm.curator_id = detail.curator?.id ?? ''
    taskForm.parent_id = detail.parent_id
    taskForm.is_urgent = detail.is_urgent
    taskForm.is_hidden = detail.is_hidden
    taskForm.due_date = detail.due_date?.slice(0, 10) ?? ''
    taskForm.image_key = detail.image_key ?? ''
    await Promise.all([
      loadBoards(),
      loadBoardColumns(detail.board_id),
      loadParentOptions(detail),
      listAttachments(props.workspaceId, task.id).then(async (list) => {
        attachments.value = list
        await hydrateAttachmentBlobs(list)
      }),
    ])
    editorOpen.value = true
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function refreshOpenEditor(taskId: string) {
  try {
    const detail = await getTaskDetail(props.workspaceId, taskId)
    taskDetail.value = detail
    currentBoardId.value = detail.board_id
    taskForm.board_id = detail.board_id
    taskForm.column_id = detail.column_id
    taskForm.title = detail.title
    taskForm.description = detail.description
    taskForm.assignee_id = detail.assignee?.id ?? ''
    taskForm.curator_id = detail.curator?.id ?? ''
    taskForm.parent_id = detail.parent_id
    taskForm.is_urgent = detail.is_urgent
    taskForm.is_hidden = detail.is_hidden
    taskForm.due_date = detail.due_date?.slice(0, 10) ?? ''
    taskForm.image_key = detail.image_key ?? ''
    await Promise.all([loadBoardColumns(detail.board_id), loadParentOptions(detail)])
  } catch {}
}

async function duplicateTask() {
  const src = taskDetail.value
  if (!src) {
    return
  }
  menuOpen.value = false
  editingTaskId.value = null
  attachments.value = []
  taskForm.title = src.title
  taskForm.description = src.description
  taskForm.assignee_id = src.assignee?.id ?? ''
  taskForm.curator_id = src.curator?.id ?? ''
  taskForm.parent_id = ''
  taskForm.board_id = src.board_id
  taskForm.column_id = src.column_id
  taskForm.is_urgent = src.is_urgent
  taskForm.is_hidden = false
  taskForm.due_date = src.due_date?.slice(0, 10) ?? ''
  taskForm.image_key = src.image_key ?? ''
  taskValidation.value = {}
  await Promise.all([loadBoards(), loadBoardColumns(src.board_id), loadParentOptions(null)])
}

async function createSubtask() {
  const parentId = editingTaskId.value
  if (!parentId) {
    return
  }
  menuOpen.value = false
  editingTaskId.value = null
  attachments.value = []
  resetForm()
  taskForm.parent_id = parentId
  await Promise.all([loadBoards(), loadBoardColumns(taskForm.board_id), loadParentOptions(null)])
  taskForm.column_id = columnOptions.value[0]?.id ?? ''
}

async function loadParentOptions(detail: TaskDetail | null) {
  let tasks: Task[] = []
  try {
    tasks = await listWorkspaceTasks(props.workspaceId)
  } catch {
    tasks = []
  }
  if (!detail) {
    parentOptions.value = tasks
    return
  }
  const excluded = new Set<string>()
  const collect = (t: { id: string; subtasks?: unknown[] }) => {
    excluded.add(t.id)
    for (const st of t.subtasks ?? []) {
      collect(st as { id: string; subtasks?: unknown[] })
    }
  }
  collect(detail)
  parentOptions.value = tasks.filter((t) => !excluded.has(t.id))
}

async function onSaveTask() {
  const result = taskFormSchema.safeParse(taskForm)
  if (!result.success) {
    taskValidation.value = collectErrors(result.error.issues)
    return
  }
  taskValidation.value = {}
  actionError.value = null
  const data = result.data
  try {
    if (editingTaskId.value) {
      const targetBoardId = data.board_id ?? currentBoardId.value
      const boardChanged = targetBoardId !== currentBoardId.value
      if (boardChanged) {
        await updateTask(props.workspaceId, currentBoardId.value, editingTaskId.value, {
          ...data,
          board_id: targetBoardId,
          column_id: undefined,
          position: undefined,
        })
        if (data.column_id && data.column_id !== columnOptions.value[0]?.id) {
          await updateTask(props.workspaceId, targetBoardId, editingTaskId.value, {
            column_id: data.column_id,
          })
        }
        await load()
      } else {
        const updated = await updateTask(props.workspaceId, targetBoardId, editingTaskId.value, {
          ...data,
          column_id: data.column_id ?? undefined,
          board_id: undefined,
          position: undefined,
        })
        applyUpdated(updated)
      }
    } else {
      const targetBoardId = data.board_id ?? props.boardId
      if (!targetBoardId) {
        return
      }
      const created = await createTask(props.workspaceId, targetBoardId, {
        title: data.title,
        description: data.description ?? '',
        column_id: data.column_id ?? taskColumnId.value,
        assignee_id: data.assignee_id,
        curator_id: data.curator_id,
        parent_id: data.parent_id,
        due_date: data.due_date,
        is_urgent: data.is_urgent,
        is_hidden: data.is_hidden,
      })
      applyCreated(created)
    }
    editorOpen.value = false
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function onPickAttachment() {
  attachmentInput.value?.click()
}

async function onAttachmentFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || attachmentUploading.value || !editingTaskId.value) {
    return
  }
  attachmentUploading.value = true
  try {
    const created = await createAttachment(props.workspaceId, editingTaskId.value, file)
    attachments.value.push(created)
    await hydrateAttachmentBlobs([created])
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    attachmentUploading.value = false
  }
}

async function removeAttachment(attachment: TaskAttachment) {
  if (!editingTaskId.value) {
    return
  }
  try {
    await deleteAttachment(props.workspaceId, editingTaskId.value, attachment.id)
    attachments.value = attachments.value.filter((a) => a.id !== attachment.id)
    if (attachmentBlobs[attachment.id]) {
      URL.revokeObjectURL(attachmentBlobs[attachment.id])
      delete attachmentBlobs[attachment.id]
    }
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function onPickCover() {
  coverInput.value?.click()
}

async function onCoverFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || coverUploading.value) {
    return
  }
  coverUploading.value = true
  try {
    const res = await uploadImage(file, 'covers')
    taskForm.image_key = res.key
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    coverUploading.value = false
  }
}

function clearCover() {
  taskForm.image_key = ''
}

async function archiveTask() {
  if (!editingTaskId.value) {
    return
  }
  menuOpen.value = false
  try {
    await updateTask(props.workspaceId, currentBoardId.value, editingTaskId.value, {
      archived: true,
    })
    editorOpen.value = false
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

watch(
  () => taskForm.board_id,
  async (newBoardId, oldBoardId) => {
    if (!editorOpen.value || newBoardId === oldBoardId) {
      return
    }
    await loadBoardColumns(newBoardId)
    taskForm.column_id = columnOptions.value[0]?.id ?? ''
  },
)

async function onDragEnd(evt: DragEndEvent) {
  if (!props.boardId) {
    return
  }
  const targetColumnId = evt.to.dataset.columnId
  const taskId = evt.item.dataset.taskId
  if (!targetColumnId || !taskId) {
    return
  }
  try {
    const updated = await updateTask(props.workspaceId, props.boardId, taskId, {
      column_id: targetColumnId,
      position: evt.newIndex,
    })
    applyUpdated(updated)
  } catch (e) {
    actionError.value = extractError(e)
    void load()
  }
}

function clearTaskError(field: keyof TaskFormValues) {
  if (taskValidation.value[field]) {
    delete taskValidation.value[field]
  }
}

watch(
  () => props.boardId,
  () => {
    void load()
  },
)

watch(
  () => props.workspaceId,
  (newWsId, oldWsId) => {
    if (oldWsId) {
      ws.leave(`workspace:${oldWsId}`)
    }
    ws.join(`workspace:${newWsId}`)
  },
)

onMounted(async () => {
  ws.connect()
  await Promise.all([load(), loadWorkspace()])
  ws.join(`workspace:${props.workspaceId}`)
  for (const type of [
    'presence',
    'workspace.updated',
    'board.updated',
    'board.deleted',
    'task.created',
    'task.updated',
    'task.deleted',
    'attachment.created',
    'attachment.deleted',
  ]) {
    unsubscribes.push(ws.on(type, handleWsMessage))
  }
})

onUnmounted(() => {
  disposed = true
  document.removeEventListener('pointerdown', onDueDocClick)
  document.removeEventListener('keydown', onDueKeydown)
  window.removeEventListener('scroll', positionDuePopup, true)
  document.removeEventListener('pointerdown', onTaskMenuDocClick)
  document.removeEventListener('keydown', onTaskMenuKeydown)
  ws.leave(`workspace:${props.workspaceId}`)
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

function closeEditor() {
  editorOpen.value = false
  menuOpen.value = false
  revokeAttachmentBlobs()
}
</script>

<template>
	<div
		class="flex h-full min-h-0 flex-col"
	>
		<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
		<p
			v-if="loading && columns.length === 0"
			class="mb-4 text-sm text-neutral-600 dark:text-neutral-400"
		>
			Loading...
		</p>

		<div v-if="columns.length" class="flex min-h-0 flex-1 flex-col gap-3">
			<div v-if="actionError" class="text-sm text-blue-700 dark:text-blue-400">
				{{ actionError }}
			</div>
			<div class="flex min-h-0 flex-1 flex-col border border-neutral-300 dark:border-neutral-700">
				<div
					class="grid divide-x divide-neutral-300 border-b border-neutral-300 dark:divide-neutral-700 dark:border-neutral-700"
					:style="{ gridTemplateColumns: `repeat(${filteredColumns.length}, minmax(0, 1fr))` }"
				>
					<div v-for="column in filteredColumns" :key="column.id" class="flex items-center gap-1 px-3 py-2" data-column-head>
						<span
							class="min-w-0 truncate text-sm font-semibold text-blue-700 dark:text-blue-400"
							:title="column.name"
						>{{ column.name }}</span>
						<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{{ column.task_count }}</span>
					</div>
				</div>
				<div
					class="grid min-h-0 flex-1 auto-rows-fr divide-x divide-neutral-300 dark:divide-neutral-700"
					:style="{ gridTemplateColumns: `repeat(${filteredColumns.length}, minmax(0, 1fr))` }"
				>
					<div
						v-for="column in filteredColumns"
						:key="column.id"
						class="flex min-w-0 min-h-0 flex-col"
						:class="{ 'pointer-events-none opacity-50': !canEdit }"
					>
						<VueDraggable
							v-model="column.tasks"
							:group="{ name: 'tasks' }"
							:animation="150"
							ghost-class="opacity-40"
							class="flex min-h-24 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-1.5"
							:data-column-id="column.id"
							@end="onDragEnd"
						>
							<div
								v-for="task in column.tasks"
								:key="task.id"
								:data-task-id="task.id"
								class="relative cursor-pointer border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900"
								@click="canEdit && openEdit(task)"
							>
								<span
									v-if="task.is_urgent"
									class="pointer-events-none absolute left-1/2 top-1 z-10 h-[3px] w-[25%] max-w-24 -translate-x-1/2 bg-blue-700 dark:bg-blue-400"
								/>
								<img
									v-if="task.image_key"
									:src="imageUrl(task.image_key)"
									:alt="task.title"
									class="mb-2 aspect-video w-full object-cover"
								/>
								<div class="p-2">
									<div class="flex items-start justify-between gap-1">
										<p class="line-clamp-2 break-words text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ task.title }}</p>
									</div>
									<p
										v-if="task.due_date"
										class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400"
									>
										{{ task.due_date.slice(0, 10) }}
									</p>
									<div class="mt-1 flex items-center justify-between gap-1 text-xs text-neutral-500 dark:text-neutral-400">
										<span class="flex min-w-0 items-center gap-1">
											<span class="truncate">{{ task.display_id }}</span>
										</span>
										<span
											v-if="task.assignee"
											class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800"
										>
											<img
												v-if="task.assignee.avatar_key"
												:src="imageUrl(task.assignee.avatar_key)"
												alt="avatar"
												class="h-full w-full object-cover"
											/>
											<User v-else :size="14" class="shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
										</span>
									</div>
								</div>
								<div
									v-for="st in childrenByParent.get(task.id) ?? []"
									:key="st.id"
									:data-subtask-id="st.id"
									class="relative cursor-pointer border-t border-neutral-200 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950/40 dark:hover:bg-neutral-800"
									@click.stop="canEdit && openEdit(st)"
								>
									<div
										v-if="boardColumnIndex(st.board_id, st.column_id) >= 0 && boardColumnIndex(st.board_id, st.column_id) < boardColumnCount(st.board_id) - 1"
										class="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[3px]"
									>
										<span
											v-for="(c, i) in columnsOf(st.board_id)"
											:key="c.id"
											class="flex-1"
											:class="subtaskProgressClass(st.board_id, st.column_id, i)"
										/>
									</div>
									<div class="flex items-center gap-1.5 px-2 py-1.5 pr-3 text-xs">
										<span
											v-if="st.board_id !== board?.id"
											class="max-w-[7rem] shrink-0 truncate font-medium text-neutral-900 dark:text-neutral-100"
										>
											{{ st.board_name }}
										</span>
										<span
											v-if="st.board_id !== board?.id"
											class="shrink-0 text-neutral-400 dark:text-neutral-500"
										>
											&gt;
										</span>
										<span class="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
											{{ st.display_id }}
										</span>
										<Flame
											v-if="st.is_urgent"
											:size="12"
											class="shrink-0 text-blue-700 dark:text-blue-400"
											aria-hidden="true"
										/>
										<span class="truncate text-neutral-600 dark:text-neutral-300">
											{{ st.title }}
										</span>
										<span
											class="ml-auto px-1"
											:class="columnChipClass(st.board_id, st.column_id)"
										>
											{{ st.column_name }}
										</span>
									</div>
								</div>
							</div>
						</VueDraggable>
					</div>
				</div>
			</div>
		</div>

		<p
			v-if="!loading && !loadError && columns.length === 0"
			class="border border-neutral-300 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
		>
			This board has no columns.
		</p>

		<div v-if="editorOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" @click.self="closeEditor">
			<form class="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" novalidate @submit.prevent="onSaveTask">
				<div class="flex items-center justify-between border-b border-neutral-300 px-6 py-3 dark:border-neutral-700">
					<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
						{{ editingTaskId ? taskDetail?.display_id ?? '' : 'New task' }}
					</span>
					<div class="flex w-16 items-center justify-end gap-1">
						<div v-if="editingTaskId" class="relative flex items-center">
							<button
								ref="taskMenuAnchor"
								type="button"
								class="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
								aria-label="Task actions"
								@click="menuOpen = !menuOpen"
							>
								<MoreHorizontal class="h-5 w-5" />
							</button>
							<div
								v-if="menuOpen"
								ref="taskMenu"
								class="absolute right-0 top-full z-50 mt-1 w-56 border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
							>
								<button type="button" class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800" @click="duplicateTask">
									Duplicate task
								</button>
								<button type="button" class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800" @click="archiveTask">
									Archive
								</button>
							</div>
						</div>
						<button
							type="button"
							class="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
							aria-label="Close"
							@click="closeEditor"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</div>

				<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
					<div class="flex flex-col gap-1">
						<label for="task_title" class="text-sm">Title</label>
						<input
							id="task_title"
							v-model="taskForm.title"
							type="text"
							maxlength="120"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearTaskError('title')"
						/>
						<p v-if="taskValidation.title" class="text-sm text-blue-700 dark:text-blue-400">{{ taskValidation.title }}</p>
					</div>

					<div v-if="editingTaskId" class="flex flex-col gap-1">
						<div class="flex items-center justify-between">
							<span class="text-sm">Cover image</span>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
									:disabled="coverUploading"
									@click="onPickCover"
								>
									<ImagePlus class="h-4 w-4" />
									{{ coverUploading ? 'Uploading...' : taskForm.image_key ? 'Replace' : 'Add' }}
								</button>
								<button
									v-if="taskForm.image_key"
									type="button"
									class="text-sm text-neutral-500 hover:text-blue-700 dark:text-neutral-400 dark:hover:text-blue-400"
									@click="clearCover"
								>
									Remove
								</button>
							</div>
						</div>
						<div v-if="taskForm.image_key" class="border border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/40">
							<img
								:src="imageUrl(taskForm.image_key)"
								alt="cover"
								class="aspect-video w-full object-cover"
							/>
						</div>
						<input ref="coverInput" type="file" accept="image/*" class="hidden" @change="onCoverFile" />
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<TagCheck v-model="taskForm.is_urgent" label="Urgent" />
						<TagSelect
							v-model="taskForm.board_id"
							label="Board"
							:options="boardOptions"
							:disabled="boards.length === 0"
							value-max-w="max-w-32"
						/>
						<TagSelect
							v-model="taskForm.column_id"
							label="Column"
							:options="columnOptionList"
							:disabled="columnOptions.length === 0"
							value-max-w="max-w-32"
						/>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<TagCheck v-model="taskForm.is_hidden" label="Closed" />
						<TagSelect
							v-model="taskForm.curator_id"
							label="Curator"
							:options="memberOptions"
							:allow-empty="true"
							empty-label="none"
							value-max-w="max-w-32"
						/>
						<TagSelect
							v-model="taskForm.assignee_id"
							label="Assignee"
							:options="memberOptions"
							:allow-empty="true"
							empty-label="unassigned"
							value-max-w="max-w-32"
						/>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<TagSelect
							v-model="taskForm.parent_id"
							label="Parent"
							:options="parentOptionList"
							:allow-empty="true"
							empty-label="none"
							value-max-w="max-w-40"
						/>
						<div class="relative">
							<button
								ref="dueAnchor"
								type="button"
								class="flex min-h-[2.8rem] items-center gap-[0.6rem] border border-neutral-300 bg-white px-4 text-left outline-none focus:border-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-400"
								:class="{ 'border-blue-600 dark:border-blue-400': dueOpen }"
								@click="openDuePopup"
							>
								<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">Due date</span>
								<span class="max-w-40 truncate text-sm" :class="taskForm.due_date ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'" :title="dueLabel">
									{{ dueLabel || 'set' }}
								</span>
								<ChevronDown class="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
							</button>
							<Teleport to="body">
								<div
									v-if="dueOpen"
									ref="dueMenu"
									class="fixed z-[60] border border-neutral-300 bg-white p-3 shadow-[0_1rem_3rem_rgba(0,0,0,0.22)] dark:border-neutral-700 dark:bg-neutral-900"
									:style="{ top: `${dueRect.top}px`, left: `${dueRect.left}px` }"
								>
									<div class="w-64">
									<div class="flex items-center justify-between gap-2">
										<button
											type="button"
											class="flex aspect-square w-7 items-center justify-center border border-neutral-300 text-neutral-500 hover:border-blue-600 hover:text-blue-700 focus:outline-none dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
											aria-label="Previous month"
											@click="duePrevMonth"
										>
											<ChevronLeft class="h-4 w-4" />
										</button>
										<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{
											dueMonthLabel
										}}</span>
										<button
											type="button"
											class="flex aspect-square w-7 items-center justify-center border border-neutral-300 text-neutral-500 hover:border-blue-600 hover:text-blue-700 focus:outline-none dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
											aria-label="Next month"
											@click="dueNextMonth"
										>
											<ChevronRight class="h-4 w-4" />
										</button>
									</div>
									<div class="mt-2 grid grid-cols-7 text-center text-xs text-neutral-500 dark:text-neutral-400">
										<span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
									</div>
									<div class="mt-1 grid grid-cols-7 gap-1">
										<button
											v-for="cell in dueCells"
											:key="cell.dateStr"
											type="button"
											class="aspect-square flex items-center justify-center text-sm disabled:cursor-default focus:outline-none"
											:class="dueCellClass(cell)"
											:disabled="!cell.inMonth"
											@click="pickDueDate(cell.dateStr)"
										>
											{{ cell.day }}
										</button>
									</div>
								</div>
									<div class="mt-2 flex items-center justify-end gap-1">
										<button
											type="button"
											class="border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
											@click="clearDueDate"
										>
											Clear
										</button>
										<button
											type="button"
											class="bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 dark:bg-blue-500 dark:text-neutral-900 dark:hover:bg-blue-400"
											@click="saveDueDate"
										>
											Save
										</button>
									</div>
								</div>
							</Teleport>
						</div>
					</div>

					<div class="flex flex-col border-t border-neutral-300 bg-neutral-50 px-6 py-4 -mx-6 dark:border-neutral-700 dark:bg-neutral-800/40">
						<label for="task_description" class="text-sm">Description</label>
						<textarea
							id="task_description"
							v-model="taskForm.description"
							v-autosize
							rows="3"
							maxlength="1500"
							class="mt-2 min-h-40 w-full resize-none bg-transparent text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
							placeholder="Description"
							@input="clearTaskError('description')"
						/>
						<p v-if="taskValidation.description" class="text-sm text-blue-700 dark:text-blue-400">{{ taskValidation.description }}</p>
					</div>

					<div v-if="editingTaskId" class="flex flex-col gap-1">
						<span class="text-sm">Attachments</span>
						<div class="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
							<a
								v-for="a in attachments"
								:key="a.id"
								:href="attachmentBlobs[a.id] || a.url"
								target="_blank"
								rel="noopener noreferrer"
								class="group relative aspect-square border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
							>
								<img
									v-if="a.content_type.startsWith('image/')"
									:src="attachmentBlobs[a.id] || a.url"
									:alt="a.filename"
									class="absolute inset-0 h-full w-full object-cover"
								/>
								<div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
									<File class="h-6 w-6 shrink-0 text-neutral-500 dark:text-neutral-400" />
									<span class="w-full truncate text-center text-xs text-neutral-600 dark:text-neutral-400">{{ a.filename }}</span>
								</div>
								<button
									type="button"
									class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center border border-neutral-300 bg-white text-neutral-600 opacity-0 transition-opacity hover:bg-neutral-100 focus:opacity-100 group-hover:opacity-100 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
									aria-label="Remove attachment"
									@click.prevent.stop="removeAttachment(a)"
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</a>
							<button
								type="button"
								class="flex aspect-square items-center justify-center border border-dashed border-neutral-300 text-neutral-500 hover:border-blue-600 hover:text-blue-700 focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
								:disabled="attachmentUploading"
								aria-label="Add attachment"
								title="Add attachment"
								@click="onPickAttachment"
							>
								<ImagePlus v-if="!attachmentUploading" class="h-5 w-5" />
								<span v-else class="text-xs">Uploading...</span>
							</button>
						</div>
						<input ref="attachmentInput" type="file" class="hidden" @change="onAttachmentFile" />
					</div>

					<div v-if="editingTaskId" class="flex flex-col gap-1">
						<span class="text-sm">Subtasks</span>
						<ul v-if="taskDetail?.subtasks.length" class="flex flex-col border border-neutral-300 dark:border-neutral-600">
							<li
								v-for="st in taskDetail.subtasks"
								:key="st.id"
								class="relative cursor-pointer border-t border-neutral-200 bg-neutral-50 first:border-t-0 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950/40 dark:hover:bg-neutral-800"
							>
								<button
									type="button"
									class="flex w-full items-center gap-1.5 px-2 py-1.5 pr-3 text-left text-xs focus:outline-none"
									@click="openEdit(st)"
								>
									<span v-if="st.board_id !== currentBoardId" class="max-w-[7rem] shrink-0 truncate font-medium text-neutral-900 dark:text-neutral-100">{{
										st.board_name
									}}</span>
									<span v-if="st.board_id !== currentBoardId" class="shrink-0 text-neutral-400 dark:text-neutral-500">&gt;</span>
									<span class="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{{ st.display_id }}</span>
									<Flame v-if="st.is_urgent" :size="12" class="shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
									<span class="truncate text-neutral-600 dark:text-neutral-300">{{ st.title }}</span>
									<span class="ml-auto px-1" :class="columnChipClass(st.board_id, st.column_id)">{{ st.column_name }}</span>
								</button>
								<div
									v-if="boardColumnIndex(st.board_id, st.column_id) >= 0"
									class="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[3px]"
								>
									<span
										v-for="(c, i) in columnsOf(st.board_id)"
										:key="c.id"
										class="flex-1"
										:class="subtaskProgressClass(st.board_id, st.column_id, i)"
									/>
								</div>
							</li>
						</ul>
						<p v-else class="text-sm text-neutral-500 dark:text-neutral-400">No subtasks.</p>
						<button
							type="button"
							class="flex w-full items-center gap-1.5 border border-neutral-300 bg-neutral-50 px-2 py-2 text-left text-xs text-blue-700 hover:border-blue-600 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-950/40 dark:text-blue-400 dark:hover:border-blue-400 dark:hover:bg-neutral-800"
							@click="createSubtask"
						>
							<Plus class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
							New subtask
						</button>
					</div>

					<p v-if="actionError" class="text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>
					<div class="flex items-center justify-end gap-2 border-t border-neutral-300 pt-4 dark:border-neutral-700">
						<button
							type="button"
							class="border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
							@click="closeEditor"
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
</template>
