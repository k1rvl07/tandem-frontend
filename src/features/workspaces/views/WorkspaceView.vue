<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Palette,
  Pencil,
  Settings,
  Star,
  UserRound,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRoute, useRouter } from 'vue-router'
import { useWS } from '@/api/ws'
import {
  addBoardFavorite,
  createBoard,
  deleteBoard,
  listBoards,
  removeBoardFavorite,
  reorderBoards,
  setMainBoard,
  updateBoard,
} from '@/features/boards/api'
import BoardKanban from '@/features/boards/components/BoardKanban.vue'
import { ACCENT_PRESETS, DEFAULT_ACCENT, useTheme } from '@/shared/composables/useTheme'
import type { Board, WorkspaceDetail, WorkspaceMember } from '@/shared/types'
import ProfileMenu from '@/shared/ui/ProfileMenu.vue'
import SignedImage from '@/shared/ui/SignedImage.vue'
import TagCheck from '@/shared/ui/TagCheck.vue'
import TagSelect from '@/shared/ui/TagSelect.vue'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import {
  addMember,
  addWorkspaceFavorite,
  deleteWorkspace,
  disableInvite,
  getInvite,
  getWorkspace,
  removeMember,
  removeWorkspaceFavorite,
  setWorkspaceTheme,
  transferOwner,
  updateMemberRole,
  updateWorkspace,
} from '../api'
import {
  type AddMemberValues,
  addMemberSchema,
  type WorkspaceFormValues,
  workspaceFormSchema,
} from '../schema'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const { isDark, accent: themeAccent, setAccent, previewAccent } = useTheme()

const workspaceId = computed(() => String(route.params.id))
const queryBoardId = computed(() =>
  typeof route.query.board === 'string' ? route.query.board : null,
)
const queryTaskId = computed(() => (typeof route.query.task === 'string' ? route.query.task : null))

const detail = ref<WorkspaceDetail | null>(null)
const boards = ref<Board[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)

const actorId = auth.user?.id ?? ''
const canEdit = computed(() => detail.value?.role === 'owner' || detail.value?.role === 'editor')
const canManage = computed(() => detail.value?.role === 'owner')

const form = reactive<WorkspaceFormValues>({ name: '', description: '', prefix: '' })
const formValidation = ref<Partial<Record<keyof WorkspaceFormValues, string>>>({})

const memberForm = reactive<AddMemberValues>({ login: '', role: 'member' })
const memberValidation = ref<Partial<Record<keyof AddMemberValues, string>>>({})
const transferTarget = ref('')

const roleOptions = [
  { label: 'editor', value: 'editor' },
  { label: 'member', value: 'member' },
]
const transferOptions = computed(() =>
  transferCandidates.value.map((m) => ({ label: `${m.display_name} (${m.login})`, value: m.id })),
)

const nowTick = ref(Date.now())
let inviteTicker: number | null = null

const inviteExpired = computed(() => {
  if (!inviteExpiresAt.value) return false
  return new Date(inviteExpiresAt.value).getTime() <= nowTick.value
})

const inviteExpiryNear = computed(() => {
  if (!inviteExpiresAt.value || inviteExpired.value) return false
  return new Date(inviteExpiresAt.value).getTime() - nowTick.value < 24 * 60 * 60 * 1000
})

function formatInviteExpiry(): string {
  if (!inviteExpiresAt.value) {
    return ''
  }
  return new Date(inviteExpiresAt.value).toLocaleString()
}

function formatInviteRemaining(): string {
  if (!inviteExpiresAt.value) {
    return ''
  }
  const diff = Math.max(0, new Date(inviteExpiresAt.value).getTime() - nowTick.value)
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m left`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s left`
  }
  return `${seconds}s left`
}

const boardForm = reactive<{ name: string }>({ name: '' })
const boardValidation = ref<Partial<Record<string, string>>>({})

const settingsOpen = ref(false)
const workspaceModalOpen = ref(false)
const membersModalOpen = ref(false)
const boardMenuId = ref<string | null>(null)

const inviteToken = ref<string | null>(null)
const inviteExpiresAt = ref<string | null>(null)
const inviteLoading = ref(false)
const inviteError = ref<string | null>(null)
const inviteCopied = ref(false)

const boardSettingsOpen = ref(false)
const boardSettingsBoardId = ref<string | null>(null)
const boardNameInput = ref('')
const savingBoardName = ref(false)
const savingBoardSettings = ref(false)

const prefixModalOpen = ref(false)
const prefixDraft = ref('')
const prefixError = ref<string | null>(null)
const prefixSaving = ref(false)

const boardCreateOpen = ref(false)
const pageMenu = ref<'workspace' | 'board' | 'invite' | null>(null)

const paletteOpen = ref(false)
const paletteMode = ref<'personal' | 'workspace'>('personal')

const kanbanRef = ref<InstanceType<typeof BoardKanban> | null>(null)
const myTasks = ref(false)
const assigneeFilterOpen = ref(false)
const assigneePopupOpen = ref(false)
const assigneeId = ref('')
const noAssignee = ref(false)

const assigneeLabel = computed(() => {
  const m = detail.value?.members.find((x) => x.id === assigneeId.value) ?? null
  return m ? `${m.display_name} (${m.login})` : 'All assignees'
})

function onSelectAssignee(id: string) {
  assigneeId.value = id
  assigneePopupOpen.value = false
}

const PALETTE_MODE_KEY = 'tandem_ws_palette'

const visibleBoards = computed(() => boards.value.toSorted((a, b) => a.position - b.position))
const mainBoard = computed(() => boards.value.find((b) => b.is_main) ?? null)

const activeBoard = computed(() => {
  const id = queryBoardId.value
  if (id) {
    const found = boards.value.find((b) => b.id === id)
    if (found) {
      return id
    }
  }
  return mainBoard.value?.id ?? visibleBoards.value[0]?.id ?? null
})

const activeBoardMeta = computed(() => boards.value.find((b) => b.id === activeBoard.value) ?? null)
const board = computed(() => boards.value.find((b) => b.id === boardSettingsBoardId.value) ?? null)

async function toggleBoardFavorite(boardId: string) {
  const meta = boards.value.find((b) => b.id === boardId)
  if (!meta) {
    return
  }
  actionError.value = null
  try {
    if (meta.is_favorite) {
      await removeBoardFavorite(meta.id)
    } else {
      await addBoardFavorite(meta.id)
    }
    meta.is_favorite = !meta.is_favorite
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function toggleWorkspaceFavorite() {
  const ws = detail.value
  if (!ws) {
    return
  }
  actionError.value = null
  try {
    if (ws.is_favorite) {
      await removeWorkspaceFavorite(ws.id)
    } else {
      await addWorkspaceFavorite(ws.id)
    }
    ws.is_favorite = !ws.is_favorite
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function openBoardSettings(id: string) {
  const b = boards.value.find((x) => x.id === id)
  boardSettingsBoardId.value = id
  boardNameInput.value = b?.name ?? ''
  boardMenuId.value = null
  workspaceModalOpen.value = false
  boardSettingsOpen.value = true
}

function backToWorkspaceSettings() {
  boardSettingsOpen.value = false
  workspaceModalOpen.value = true
}

async function onSaveBoardName() {
  const boardId = boardSettingsBoardId.value
  const name = boardNameInput.value.trim()
  if (!boardId || !name) {
    return
  }
  savingBoardName.value = true
  actionError.value = null
  try {
    await updateBoard(workspaceId.value, boardId, { name })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    savingBoardName.value = false
  }
}

async function onSaveBoardSettings() {
  const boardId = boardSettingsBoardId.value
  if (!boardId) {
    return
  }
  savingBoardSettings.value = true
  actionError.value = null
  try {
    const name =
      boardNameInput.value.trim() || boards.value.find((x) => x.id === boardId)?.name || ''
    await updateBoard(workspaceId.value, boardId, { name })
    boardSettingsOpen.value = false
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    savingBoardSettings.value = false
  }
}

function accent(): string {
  return detail.value?.theme ? `#${detail.value.theme}` : DEFAULT_ACCENT
}

function selectBoard(id: string) {
  router.replace({ query: { board: id } })
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-menu="settings"]')) {
    settingsOpen.value = false
  }
  if (!target.closest('[data-menu="palette"]')) {
    paletteOpen.value = false
  }
  if (!target.closest('[data-menu="assignee"]')) {
    assigneePopupOpen.value = false
  }
  if (!target.closest('[data-menu="pageMenu"]')) {
    pageMenu.value = null
  }
}

async function load() {
  loading.value = true
  loadError.value = null
  actionError.value = null
  try {
    const [d, b] = await Promise.all([
      getWorkspace(workspaceId.value),
      listBoards(workspaceId.value),
    ])
    detail.value = d
    form.name = d.name
    form.description = d.description
    form.prefix = d.prefix
    boards.value = b
    if (transferTarget.value && !d.members.some((m) => m.id === transferTarget.value)) {
      transferTarget.value = ''
    }
    if (!transferTarget.value) {
      const firstTarget = d.members.find((m) => m.id !== actorId)
      transferTarget.value = firstTarget?.id ?? ''
    }
    const stored = localStorage.getItem(`${PALETTE_MODE_KEY}_${d.id}`)
    paletteMode.value = stored ? (stored === 'workspace' ? 'workspace' : 'personal') : 'workspace'
    if (paletteMode.value === 'workspace') {
      previewAccent(accent())
    }
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    loading.value = false
  }
}

async function refreshBoards() {
  try {
    boards.value = await listBoards(workspaceId.value)
  } catch {}
}

function applyActiveBoardTheme() {
  if (paletteMode.value === 'workspace') {
    previewAccent(accent())
  } else {
    setAccent(themeAccent.value)
  }
}

const transferCandidates = computed(() => {
  return detail.value?.members.filter((m) => m.id !== actorId) ?? []
})

function canRemove(member: WorkspaceMember): boolean {
  if (member.role === 'owner') {
    return false
  }
  return canManage.value
}

function canChangeRole(member: WorkspaceMember): boolean {
  return canManage.value && member.role !== 'owner'
}

function clearFormError(field: keyof WorkspaceFormValues) {
  if (formValidation.value[field]) {
    delete formValidation.value[field]
  }
}

function clearMemberError(field: keyof AddMemberValues) {
  if (memberValidation.value[field]) {
    delete memberValidation.value[field]
  }
}

function validateWorkspaceForm(): boolean {
  const result = workspaceFormSchema.safeParse(form)
  if (!result.success) {
    formValidation.value = collectErrors(result.error.issues)
    return false
  }
  formValidation.value = {}
  return true
}

async function autosaveWorkspace() {
  if (!validateWorkspaceForm()) {
    return
  }
  actionError.value = null
  try {
    await updateWorkspace(workspaceId.value, {
      name: form.name.trim(),
      description: form.description.trim(),
      prefix: (form.prefix ?? '').trim(),
    })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function openPrefixModal() {
  prefixDraft.value = form.prefix ?? ''
  prefixError.value = null
  prefixModalOpen.value = true
}

async function onSavePrefix() {
  const result = workspaceFormSchema.shape.prefix.safeParse(prefixDraft.value.toUpperCase())
  if (!result.success) {
    prefixError.value = result.error.issues[0]?.message ?? 'invalid prefix'
    return
  }
  prefixSaving.value = true
  actionError.value = null
  form.prefix = prefixDraft.value.trim().toUpperCase()
  try {
    await updateWorkspace(workspaceId.value, {
      name: form.name.trim(),
      description: form.description.trim(),
      prefix: form.prefix,
    })
    prefixModalOpen.value = false
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  } finally {
    prefixSaving.value = false
  }
}

async function onCreateBoard() {
  const result = workspaceFormSchema.safeParse({
    name: boardForm.name,
    description: '',
    prefix: '',
  })
  if (!result.success) {
    boardValidation.value = collectErrors(result.error.issues)
    return
  }
  boardValidation.value = {}
  actionError.value = null
  try {
    const created = await createBoard(workspaceId.value, { name: result.data.name })
    boardForm.name = ''
    boardCreateOpen.value = false
    workspaceModalOpen.value = false
    await load()
    router.replace({ query: { board: created.id } })
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onRenameBoard(id: string, name: string) {
  if (!name.trim()) {
    return
  }
  actionError.value = null
  try {
    await updateBoard(workspaceId.value, id, { name: name.trim() })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onDeleteBoard(id: string) {
  const meta = boards.value.find((b) => b.id === id)
  if (!window.confirm(`Delete board ${meta?.name ?? ''}? This cannot be undone.`)) {
    return
  }
  actionError.value = null
  try {
    await deleteBoard(workspaceId.value, id)
    const wasActive = activeBoard.value === id
    await load()
    if (wasActive) {
      router.replace({ query: { board: mainBoard.value?.id } })
    }
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onSetMain(id: string) {
  actionError.value = null
  try {
    await setMainBoard(workspaceId.value, id)
    await load()
    settingsOpen.value = false
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onReorder(e: { oldIndex?: number; newIndex?: number }) {
  if (e.oldIndex === undefined || e.newIndex === undefined || e.oldIndex === e.newIndex) {
    return
  }
  actionError.value = null
  const ids = [...visibleBoards.value].sort((a, b) => a.position - b.position)
  const [moved] = ids.splice(e.oldIndex, 1)
  ids.splice(e.newIndex, 0, moved)
  try {
    await reorderBoards(workspaceId.value, { board_ids: ids.map((b) => b.id) })
    await load()
  } catch (err) {
    actionError.value = extractError(err)
  }
}

async function onAddMember() {
  const result = addMemberSchema.safeParse(memberForm)
  if (!result.success) {
    memberValidation.value = collectErrors(result.error.issues)
    return
  }
  memberValidation.value = {}
  actionError.value = null
  try {
    await addMember(workspaceId.value, result.data)
    memberForm.login = ''
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onRemoveMember(member: WorkspaceMember) {
  if (!window.confirm(`Remove ${member.display_name || member.login}?`)) {
    return
  }
  actionError.value = null
  try {
    await removeMember(workspaceId.value, member.id)
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onChangeRole(member: WorkspaceMember, role: string) {
  actionError.value = null
  try {
    await updateMemberRole(workspaceId.value, member.id, { role: role as 'editor' | 'member' })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onTransfer() {
  if (!transferTarget.value) {
    return
  }
  const target = detail.value?.members.find((m) => m.id === transferTarget.value)
  if (!window.confirm(`Transfer ownership to ${target?.display_name || target?.login}?`)) {
    return
  }
  actionError.value = null
  try {
    await transferOwner(workspaceId.value, { user_id: transferTarget.value })
    await load()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onLoadInvite() {
  if (inviteToken.value) {
    return
  }
  inviteLoading.value = true
  inviteError.value = null
  try {
    const res = await getInvite(workspaceId.value)
    inviteToken.value = res.invite_token
    inviteExpiresAt.value = res.expires_at ?? null
    inviteCopied.value = false
  } catch (e) {
    inviteError.value = extractError(e)
  } finally {
    inviteLoading.value = false
  }
}

function inviteUrl(token: string): string {
  const base = window.location.origin
  return `${base}/invite/${token}`
}

async function onCopyInvite() {
  const token = inviteToken.value
  if (!token) {
    return
  }
  try {
    await navigator.clipboard.writeText(inviteUrl(token))
    inviteCopied.value = true
    window.setTimeout(() => {
      inviteCopied.value = false
    }, 2000)
  } catch {
    inviteError.value = 'Could not copy the link'
  }
}

async function onDisableInvite() {
  if (!window.confirm('Disable this invite link?')) {
    return
  }
  inviteLoading.value = true
  inviteError.value = null
  try {
    await disableInvite(workspaceId.value)
    inviteToken.value = null
    inviteExpiresAt.value = null
    inviteCopied.value = false
  } catch (e) {
    inviteError.value = extractError(e)
  } finally {
    inviteLoading.value = false
  }
}

async function onDelete() {
  if (!window.confirm(`Delete workspace ${detail.value?.name}?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteWorkspace(workspaceId.value)
    await router.push('/')
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function paletteButtonColor(hex: string): boolean {
  const activeColor = paletteMode.value === 'workspace' ? accent() : themeAccent.value
  return (
    typeof activeColor === 'string' &&
    activeColor.toLowerCase().replace('#', '') === hex.toLowerCase().replace('#', '')
  )
}

async function onPickWorkspaceColor(hex: string) {
  if (detail.value?.role !== 'owner' && detail.value?.role !== 'editor') {
    return
  }
  const code = hex.replace('#', '')
  previewAccent(hex)
  try {
    await setWorkspaceTheme(workspaceId.value, { theme: code })
    detail.value.theme = code
    paletteMode.value = 'workspace'
    localStorage.setItem(`${PALETTE_MODE_KEY}_${workspaceId.value}`, 'workspace')
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function onPickPersonalColor(hex: string) {
  setAccent(hex)
  paletteMode.value = 'personal'
  localStorage.setItem(`${PALETTE_MODE_KEY}_${workspaceId.value}`, 'personal')
}

function setPaletteMode(mode: 'personal' | 'workspace') {
  paletteMode.value = mode
  localStorage.setItem(`${PALETTE_MODE_KEY}_${workspaceId.value}`, mode)
  if (mode === 'workspace') {
    previewAccent(accent())
  } else {
    setAccent(themeAccent.value)
  }
}

async function refreshWorkspace() {
  try {
    const d = await getWorkspace(workspaceId.value)
    detail.value = d
    form.name = d.name
    form.description = d.description
    form.prefix = d.prefix
    if (paletteMode.value === 'workspace') {
      previewAccent(accent())
    } else if (paletteMode.value === 'personal') {
      setAccent(themeAccent.value)
    }
  } catch {}
}

const ws = useWS()
const wsUnsubscribes: Array<() => void> = []

function refreshOnWs() {
  void refreshBoards()
  void refreshWorkspace()
}

function onKicked(msg: { data?: unknown }) {
  const data = msg.data as { workspace_id?: string; user_id?: string } | undefined
  if (!data?.workspace_id || data.workspace_id !== workspaceId.value) {
    return
  }
  if (!data.user_id || data.user_id === actorId) {
    ws.leave(`workspace:${workspaceId.value}`)
    void router.replace('/')
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  ws.connect()
  ws.join(`workspace:${workspaceId.value}`)
  for (const type of [
    'workspace.updated',
    'board.created',
    'board.updated',
    'board.deleted',
    'boards.reordered',
    'task.created',
    'task.updated',
    'task.deleted',
    'favorites.updated',
  ]) {
    wsUnsubscribes.push(ws.on(type, refreshOnWs))
  }
  wsUnsubscribes.push(ws.on('workspace.kicked', onKicked))
  load()
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  ws.leave(`workspace:${workspaceId.value}`)
  for (const unsubscribe of wsUnsubscribes) {
    unsubscribe()
  }
  wsUnsubscribes.length = 0
  if (inviteTicker !== null) {
    window.clearInterval(inviteTicker)
    inviteTicker = null
  }
  setAccent(themeAccent.value)
})

watch(inviteExpiresAt, (value) => {
  if (inviteTicker !== null) {
    window.clearInterval(inviteTicker)
    inviteTicker = null
  }
  if (value) {
    nowTick.value = Date.now()
    inviteTicker = window.setInterval(() => {
      nowTick.value = Date.now()
    }, 1000)
  }
})

watch(inviteExpired, (expired) => {
  if (expired && inviteTicker !== null) {
    window.clearInterval(inviteTicker)
    inviteTicker = null
  }
})

watch(workspaceId, (newId, oldId) => {
  if (oldId) {
    ws.leave(`workspace:${oldId}`)
  }
  ws.join(`workspace:${newId}`)
  load()
})

watch(
  () => detail.value?.theme,
  () => {
    if (paletteMode.value === 'workspace') {
      previewAccent(accent())
    }
  },
)
</script>

<template>
	<div class="flex h-screen flex-col overflow-hidden">
		<div class="sticky top-0 z-40 border-b border-neutral-300 bg-white/95 dark:border-neutral-700 dark:bg-neutral-950/95">
			<div class="px-3 sm:px-4 md:px-6">
				<div class="flex items-center py-2">
					<div class="flex w-1/3 items-center justify-start gap-3">
						<RouterLink
							to="/"
							class="flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
							:aria-label="'Back to home'"
						>
							<ArrowLeft :size="18" />
						</RouterLink>
					</div>
					<div class="flex w-1/3 items-center justify-center">
						<h1 class="line-clamp-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
							{{ detail?.name ?? '…' }}
						</h1>
					</div>
					<div class="flex w-1/3 items-center justify-end gap-3">
						<div data-menu="palette" class="relative">
							<button
								type="button"
								aria-label="Color palette"
								class="flex h-9 w-9 items-center justify-center border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
								@click="paletteOpen = !paletteOpen"
							>
								<Palette :size="18" />
							</button>
							<div
								v-if="paletteOpen"
								class="absolute right-0 top-full z-30 mt-1 w-64 border border-neutral-300 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
							>
								<div class="flex border border-neutral-300 dark:border-neutral-600">
									<button
										type="button"
										class="flex-1 px-2 py-1.5 text-xs focus:outline-none"
										:class="paletteMode === 'personal' ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'"
										@click="setPaletteMode('personal')"
									>
										My colors
									</button>
									<button
										type="button"
										class="flex-1 border-l border-neutral-300 px-2 py-1.5 text-xs focus:outline-none dark:border-neutral-600"
										:class="paletteMode === 'workspace' ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'"
										@click="setPaletteMode('workspace')"
									>
										Workspace
									</button>
								</div>
								<div class="mt-3">
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
								</div>
								<div class="mt-3">
									<p
										v-if="paletteMode === 'workspace' && (detail?.role !== 'owner' && detail?.role !== 'editor')"
										class="mb-2 text-xs uppercase text-neutral-600 dark:text-neutral-400"
									>
										Active color
									</p>
									<p
										v-else-if="paletteMode === 'workspace'"
										class="mb-2 text-xs uppercase text-neutral-600 dark:text-neutral-400"
									>
										Set workspace color
									</p>
									<p v-else class="mb-2 text-xs uppercase text-neutral-600 dark:text-neutral-400">
										Personal accent
									</p>
									<div class="flex flex-wrap gap-2">
										<button
											v-for="color in ACCENT_PRESETS"
											:key="color"
											type="button"
											class="flex h-8 w-8 items-center justify-center border border-neutral-300 focus:outline-none dark:border-neutral-600"
											:style="{ backgroundColor: color }"
											:aria-label="`Color ${color}`"
											@click="
												paletteMode === 'workspace'
													? onPickWorkspaceColor(color)
													: onPickPersonalColor(color)
											"
										>
											<span v-if="paletteButtonColor(color)" class="text-sm font-semibold text-white">✓</span>
										</button>
									</div>
								</div>
							</div>
						</div>

						<div data-menu="settings" class="relative">
							<button
								type="button"
								aria-label="Workspace settings"
								class="flex h-9 w-9 items-center justify-center border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
								@click="settingsOpen = !settingsOpen"
							>
								<Settings :size="18" />
							</button>
							<div
								v-if="settingsOpen"
								class="absolute right-0 top-full z-30 mt-1 w-56 border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
							>
								<button
									type="button"
									class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
									@click="settingsOpen = false; workspaceModalOpen = true"
								>
									<span>Workspace settings</span>
								</button>
								<button
									v-if="activeBoard"
									type="button"
									class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
									@click="settingsOpen = false; openBoardSettings(activeBoard)"
								>
									<span>Board settings</span>
								</button>
								<button
									type="button"
									class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
									@click="settingsOpen = false; membersModalOpen = true; inviteError = null"
								>
									<span>Members</span>
								</button>
							</div>
						</div>

						<ProfileMenu />
					</div>
				</div>

				<div v-if="!loading && visibleBoards.length" class="flex items-end gap-2 overflow-x-auto py-1">
					<button
						v-for="board in visibleBoards"
						:key="board.id"
						type="button"
						class="flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm focus:outline-none"
						:class="
							activeBoard === board.id
								? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400'
								: 'border-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
						"
						@click="selectBoard(board.id)"
					>
						<span
							v-if="board.is_main"
							class="flex h-4 w-4 items-center justify-center"
							:title="'Main board'"
						>
							<Star
								:size="14"
								:fill="activeBoard === board.id ? 'currentColor' : 'none'"
							/>
						</span>
						<span class="max-w-40 truncate" :title="board.name">{{ board.name }}</span>
						<span
							class="flex h-5 min-w-5 items-center justify-center border px-1 text-xs"
							:class="
								activeBoard === board.id
									? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400'
									: 'border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400'
							"
						>
							{{ board.task_count }}
						</span>
					</button>
				</div>

				<div
					v-if="activeBoard"
					class="flex items-center justify-between gap-3 border-t border-neutral-300 py-2 dark:border-neutral-700"
				>
					<div class="flex items-center gap-3">
						<template v-if="!assigneeFilterOpen">
							<button
								type="button"
								:aria-label="'Filter by assignee'"
								title="Filter by assignee"
								class="flex h-8 w-8 items-center justify-center border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
								@click="assigneeFilterOpen = true"
							>
								<UserRound :size="16" />
							</button>
							<TagCheck v-model="myTasks" label="My tasks" compact />
						</template>
						<template v-else>
							<div data-menu="assignee" class="relative">
								<button
									type="button"
									class="flex h-8 items-center gap-2 border border-neutral-300 bg-white px-3 text-sm text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
									@click="assigneePopupOpen = !assigneePopupOpen"
								>
									<span class="max-w-48 truncate">{{ assigneeLabel }}</span>
									<ChevronDown :size="14" />
								</button>
								<div
									v-if="assigneePopupOpen"
									class="absolute left-0 top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
								>
									<button
										type="button"
										class="flex w-full items-center justify-between px-3 py-2 text-left text-sm focus:outline-none"
										:class="
											assigneeId === ''
												? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
												: 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
										"
										@click="onSelectAssignee('')"
									>
										<span class="truncate">All assignees</span>
										<Check v-if="assigneeId === ''" :size="14" class="shrink-0" />
									</button>
									<button
										v-for="m in detail?.members ?? []"
										:key="m.id"
										type="button"
										class="flex w-full items-center justify-between px-3 py-2 text-left text-sm focus:outline-none"
										:class="
											assigneeId === m.id
												? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
												: 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
										"
										@click="onSelectAssignee(m.id)"
									>
										<span class="truncate">{{ m.display_name }} ({{ m.login }})</span>
										<Check v-if="assigneeId === m.id" :size="14" class="shrink-0" />
									</button>
								</div>
							</div>
							<TagCheck v-model="noAssignee" label="Without assignee" compact />
							<button
								type="button"
								:aria-label="'Close assignee filter'"
								class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
								@click="assigneeFilterOpen = false"
							>
								<X :size="16" />
							</button>
						</template>
					</div>
					<div class="flex items-center gap-3">
						<button
							type="button"
							:aria-label="activeBoardMeta?.is_favorite ? 'Remove board from favorites' : 'Add board to favorites'"
							:title="activeBoardMeta?.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
							class="flex h-8 w-8 items-center justify-center border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-neutral-600 dark:bg-neutral-900"
							:class="
								activeBoardMeta?.is_favorite
									? 'text-blue-700 dark:text-blue-400'
									: 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200'
							"
@click="activeBoard && toggleBoardFavorite(activeBoard)"
					>
						<Star
								:size="16"
								:fill="activeBoardMeta?.is_favorite ? 'currentColor' : 'none'"
							/>
						</button>
						<button
							v-if="!loading && detail"
							type="button"
							class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
							@click="kanbanRef?.openCreate()"
						>
							Create task
						</button>
					</div>
				</div>
			</div>
		</div>

		<main class="flex-1 min-h-0 px-3 py-4 sm:px-4 md:px-6">
			<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
			<p v-if="loading && !detail" class="text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>

			<template v-if="detail">
				<div v-if="visibleBoards.length === 0 && canEdit" class="mx-auto max-w-md text-center">
					<p class="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
						This workspace has no boards yet.
					</p>
					<form class="flex flex-col gap-3" novalidate @submit.prevent="onCreateBoard">
						<input
							id="board_name"
							v-model="boardForm.name"
							type="text"
							maxlength="80"
							placeholder="Board name"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
						/>
						<p v-if="boardValidation.name" class="text-sm text-blue-700 dark:text-blue-400">
							{{ boardValidation.name }}
						</p>
						<button
							type="submit"
							class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
						>
							Create board
						</button>
					</form>
				</div>

				<BoardKanban
					v-else-if="activeBoard"
					ref="kanbanRef"
					:workspace-id="workspaceId"
					:board-id="activeBoard"
					:my-tasks="myTasks"
					:assignee-id="assigneeId"
					:no-assignee="noAssignee"
					@task-counts="
						(counts) => {
							const meta = activeBoardMeta
							if (meta) meta.task_count = counts[meta.id] ?? 0
						}
					"
				/>

				<div
					v-else
					class="border border-neutral-300 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
				>
					No active board.
				</div>
			</template>
		</main>

		<div v-if="workspaceModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" @click.self="workspaceModalOpen = false" @keydown.esc="workspaceModalOpen = false">
			<div v-if="detail" class="flex max-h-[85vh] w-[48rem] max-w-full flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
				<div class="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-700">
					<h2 class="text-lg text-neutral-900 dark:text-neutral-100">Workspace settings</h2>
					<div class="flex items-center">
						<button
							type="button"
							:aria-label="detail.is_favorite ? 'Remove workspace from favorites' : 'Add workspace to favorites'"
							:title="detail.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
							class="flex h-8 w-8 items-center justify-center focus:outline-none"
							:class="
								detail.is_favorite
									? 'text-blue-700 dark:text-blue-400'
									: 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200'
							"
							@click="toggleWorkspaceFavorite"
						>
							<Star
								:size="16"
								:fill="detail.is_favorite ? 'currentColor' : 'none'"
							/>
						</button>
						<div data-menu="pageMenu" class="relative">
							<button
								v-if="canManage"
								type="button"
								:aria-label="'Workspace actions'"
								class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
								@click="pageMenu = pageMenu === 'workspace' ? null : 'workspace'"
							>
								<MoreHorizontal :size="16" />
							</button>
							<div
								v-if="pageMenu === 'workspace'"
								class="absolute right-0 top-full z-30 mt-1 w-52 border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
							>
								<button
									type="button"
									class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-blue-700 hover:bg-neutral-100 focus:outline-none dark:text-blue-400 dark:hover:bg-neutral-800"
									@click="pageMenu = null; onDelete()"
								>
									Delete workspace
								</button>
							</div>
						</div>
						<button
							type="button"
							class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
							aria-label="Close"
							@click="workspaceModalOpen = false"
						>
							✕
						</button>
					</div>
				</div>
				<div class="flex-1 overflow-y-auto p-5">
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-1">
								<label for="edit_name" class="text-sm">Name</label>
							<input
								id="edit_name"
								v-model="form.name"
								type="text"
								maxlength="80"
								autocomplete="off"
								:disabled="!canEdit"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearFormError('name')"
								@blur="autosaveWorkspace"
							/>
							<p v-if="formValidation.name" class="text-sm text-blue-700 dark:text-blue-400">{{ formValidation.name }}</p>
						</div>
						<div class="flex flex-col gap-1">
							<label for="edit_description" class="text-sm">Description</label>
							<textarea
								id="edit_description"
								v-model="form.description"
								v-autosize
								rows="2"
								maxlength="400"
								autocomplete="off"
								:disabled="!canEdit"
								class="resize-none overflow-y-hidden border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearFormError('description')"
								@blur="autosaveWorkspace"
							/>
							<p v-if="formValidation.description" class="text-sm text-blue-700 dark:text-blue-400">{{ formValidation.description }}</p>
						</div>
						<div class="flex flex-col gap-1">
								<label for="edit_prefix" class="text-sm">Prefix</label>
								<div class="flex items-center gap-3">
									<input
										id="edit_prefix"
										v-model="form.prefix"
										type="text"
										maxlength="10"
										placeholder="Task key prefix"
										autocomplete="off"
										disabled
										class="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
									/>
									<button
										v-if="canEdit"
										type="button"
										:aria-label="'Change workspace prefix'"
										class="flex h-9 w-9 shrink-0 items-center justify-center border border-blue-700 text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
										@click="openPrefixModal"
									>
										<Pencil :size="16" />
									</button>
								</div>
							</div>
					</div>

					<div class="mt-6">
						<h3 class="mb-2 text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-400">Boards</h3>
						<div class="flex flex-col gap-1">
							<VueDraggable
								:model-value="visibleBoards"
								:animation="150"
								:disabled="!canEdit"
								class="flex flex-col gap-1"
								@update:model-value="$event => void 0"
								@end="onReorder"
							>
								<div
									v-for="board in visibleBoards"
									:key="board.id"
									class="flex items-center border border-neutral-300 bg-white py-1 dark:border-neutral-600 dark:bg-neutral-900"
								>
									<span class="flex w-8 shrink-0 cursor-grab items-center justify-center gap-[3px]">
										<span class="flex flex-col gap-[2px]">
											<span class="h-[3px] w-[3px] bg-neutral-400" />
											<span class="h-[3px] w-[3px] bg-neutral-400" />
											<span class="h-[3px] w-[3px] bg-neutral-400" />
										</span>
										<span class="flex flex-col gap-[2px]">
											<span class="h-[3px] w-[3px] bg-neutral-400" />
											<span class="h-[3px] w-[3px] bg-neutral-400" />
											<span class="h-[3px] w-[3px] bg-neutral-400" />
										</span>
									</span>
									<span class="min-w-0 flex-1 truncate px-2 text-sm text-neutral-900 dark:text-neutral-100" :title="board.name">
										{{ board.name }}
									</span>
									<span
										v-if="board.is_main"
										class="mr-1 border border-blue-700 px-1.5 py-0.5 text-xs text-blue-700 dark:border-blue-400 dark:text-blue-400"
									>
										Main
									</span>
<button
									type="button"
									:aria-label="'Board actions'"
									class="flex h-7 w-7 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
									@click="boardMenuId = board.id"
								>
									<MoreHorizontal :size="16" />
								</button>
								<button
									type="button"
									class="flex h-7 w-7 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
									:aria-label="`Open board ${board.name}`"
									@click="workspaceModalOpen = false; selectBoard(board.id)"
								>
									<ChevronRight :size="16" />
								</button>
								</div>
							</VueDraggable>
						</div>

						<div class="mt-3 flex items-center gap-4">
							<button
								v-if="canEdit"
								type="button"
								class="border border-blue-700 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
								@click="boardCreateOpen = true"
							>
								Add new board
							</button>
							<p v-if="actionError" class="text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>
						</div>

						<div v-if="boardCreateOpen" class="mt-3 flex items-center gap-3">
							<input
								v-model="boardForm.name"
								type="text"
								maxlength="80"
								placeholder="Board name"
								autocomplete="off"
								class="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="boardValidation.name && (boardValidation.name = '')"
								@keyup.enter="onCreateBoard"
							/>
							<button
								type="button"
								class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
								@click="onCreateBoard"
							>
								Create
							</button>
							<button
								type="button"
								class="border border-blue-700 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
								@click="boardCreateOpen = false; boardForm.name = ''; boardValidation = {}"
							>
								Cancel
							</button>
						</div>
						<p v-if="boardValidation.name" class="mt-2 text-sm text-blue-700 dark:text-blue-400">{{ boardValidation.name }}</p>
					</div>
				</div>
			</div>

			<div
				v-if="boardMenuId"
				class="fixed inset-0 z-[60] bg-neutral-950/40"
				@click="boardMenuId = null"
			>
				<div
					class="absolute right-1/2 top-1/2 flex w-52 translate-x-1/2 translate-y-1/2 flex-col border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
				>
					<button
						type="button"
						class="px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
						@click="selectBoard(boardMenuId); boardMenuId = null"
					>
						Open
					</button>
					<button
						v-if="canEdit"
						type="button"
						class="px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
						@click="boardMenuId ? openBoardSettings(boardMenuId) : undefined"
					>
						Board settings
					</button>
					<button
						v-if="canEdit && !(boards.find(b => b.id === boardMenuId)?.is_main)"
						type="button"
						class="px-4 py-2 text-left text-sm text-blue-700 hover:bg-neutral-100 focus:outline-none dark:text-blue-400 dark:hover:bg-neutral-800"
						@click="onDeleteBoard(boardMenuId); boardMenuId = null"
					>
						Delete board
					</button>
					<button
						v-if="canEdit && !(boards.find(b => b.id === boardMenuId)?.is_main)"
						type="button"
						class="px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
						@click="onSetMain(boardMenuId); boardMenuId = null"
					>
						Make main
					</button>
				</div>
			</div>

			<div v-if="prefixModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/60 p-4" @click.self="prefixModalOpen = false">
				<div class="w-full max-w-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
					<div class="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-700">
						<h2 class="text-lg text-neutral-900 dark:text-neutral-100">Change workspace prefix</h2>
						<button
							type="button"
							class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
							aria-label="Close"
							@click="prefixModalOpen = false"
						>
							✕
						</button>
					</div>
					<div class="flex flex-col gap-3 p-5">
						<div class="flex flex-col gap-1">
							<label for="edit_prefix2" class="text-sm">Workspace prefix</label>
							<input
								id="edit_prefix2"
								v-model="prefixDraft"
								type="text"
								maxlength="10"
								placeholder="Task key prefix"
								autocomplete="off"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="prefixError = null"
								@keyup.enter="onSavePrefix"
							/>
							<p v-if="prefixError" class="text-sm text-blue-700 dark:text-blue-400">{{ prefixError }}</p>
							<p class="text-sm text-neutral-500 dark:text-neutral-400">
								The prefix is used in task keys. Changing it does not rename existing tasks.
							</p>
						</div>
						<button
							type="button"
							:disabled="prefixSaving"
							class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
							@click="onSavePrefix"
						>
							Change prefix
						</button>
					</div>
				</div>
			</div>
		</div>

		<div v-if="membersModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" @click.self="membersModalOpen = false" @keydown.esc="membersModalOpen = false">
			<div v-if="detail" class="flex max-h-[85vh] w-[48rem] max-w-full flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
				<div class="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-700">
					<h2 class="text-lg text-neutral-900 dark:text-neutral-100">Members</h2>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
						aria-label="Close"
						@click="membersModalOpen = false"
					>
						✕
					</button>
				</div>
				<div class="flex-1 overflow-y-auto p-5">
					<p v-if="actionError" class="mb-3 text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>

					<div v-if="canManage" class="mb-5 flex flex-col gap-3 border border-neutral-300 p-4 dark:border-neutral-700">
						<h3 class="text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-400">Add member</h3>
						<input
							v-model="memberForm.login"
							type="text"
							maxlength="50"
							placeholder="Login"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearMemberError('login')"
							@keyup.enter="onAddMember"
						/>
						<p v-if="memberValidation.login" class="text-sm text-blue-700 dark:text-blue-400">{{ memberValidation.login }}</p>
						<div class="flex items-center gap-3">
							<TagSelect v-model="memberForm.role" :options="roleOptions" compact />
							<button
								type="button"
								class="flex h-8 items-center bg-blue-700 px-4 text-sm text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
								@click="onAddMember"
							>
								Add member
							</button>
						</div>
					</div>

					<div v-if="canEdit" class="mb-5 flex flex-col gap-3 border border-neutral-300 p-4 dark:border-neutral-700">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-400">Invite link</h3>
							<div data-menu="pageMenu" class="relative">
								<button
									v-if="inviteToken"
									type="button"
									:aria-label="'Invite actions'"
									class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
									@click="pageMenu = pageMenu === 'invite' ? null : 'invite'"
								>
									<MoreHorizontal :size="16" />
								</button>
								<div
									v-if="pageMenu === 'invite'"
									class="absolute right-0 top-full z-30 mt-1 w-48 border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
								>
									<button
										type="button"
										class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
										@click="pageMenu = null; onDisableInvite()"
									>
										Reset link
									</button>
								</div>
							</div>
						</div>
						<div v-if="inviteToken" class="flex items-center gap-2">
							<input
								:value="inviteUrl(inviteToken)"
								type="text"
								readonly
								class="min-w-0 flex-1 border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
							/>
							<button
								type="button"
								class="shrink-0 border border-blue-700 px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
								@click="onCopyInvite"
							>
								{{ inviteCopied ? 'Copied' : 'Copy' }}
							</button>
						</div>
						<p
							v-if="inviteToken && inviteExpiresAt"
							class="text-xs text-neutral-500 dark:text-neutral-400"
						>
							<template v-if="inviteExpired">Invite expired — generate a new link</template>
							<template v-else-if="inviteExpiryNear">Expires soon — {{ formatInviteRemaining() }}</template>
							<template v-else>Expires {{ formatInviteExpiry() }}</template>
						</p>
						<button
							v-else
							type="button"
							class="border border-blue-700 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
							:disabled="inviteLoading"
							@click="onLoadInvite"
						>
							{{ inviteLoading ? 'Generating…' : 'Get invite link' }}
						</button>
						<p v-if="inviteError" class="text-sm text-blue-700 dark:text-blue-400">{{ inviteError }}</p>
					</div>

					<h3 class="mb-2 text-sm font-semibold uppercase text-neutral-600 dark:text-neutral-400">Members</h3>
					<div class="flex flex-col gap-2">
						<div v-if="!detail.members.length" class="text-sm text-neutral-500 dark:text-neutral-400">No members yet.</div>
						<div
							v-for="member in detail.members"
							:key="member.id"
							class="flex items-center gap-3 border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-900"
						>
							<span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800">
								<SignedImage
									v-if="member.avatar_key"
									:src="member.avatar_key"
									alt="avatar"
									class="h-full w-full object-cover"
								/>
								<UserRound v-else :size="18" class="shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-neutral-900 dark:text-neutral-100">
									{{ member.display_name || member.login }}
								</p>
								<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">
									@{{ member.login }}
								</p>
							</div>
							<span
								v-if="member.role === 'owner'"
								class="shrink-0 border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 dark:border-neutral-600 dark:text-neutral-400"
							>
								owner
							</span>
							<TagSelect
								v-if="canChangeRole(member)"
								compact
								:model-value="member.role"
								:options="roleOptions"
								@update:model-value="(v) => onChangeRole(member, v)"
							/>
							<button
								v-if="canRemove(member)"
								type="button"
								class="shrink-0 border border-blue-700 px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
								@click="onRemoveMember(member)"
							>
								Remove
							</button>
						</div>
					</div>

					<div v-if="canManage && transferCandidates.length" class="mt-5 flex flex-col gap-1 border-t border-neutral-200 pt-4 dark:border-neutral-800">
						<span class="text-sm">Transfer ownership</span>
						<div class="flex items-center justify-between gap-3">
							<TagSelect v-model="transferTarget" :options="transferOptions" />
							<button
								type="button"
								class="flex h-[2.8rem] items-center border border-blue-700 px-4 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
								:disabled="!transferTarget"
								@click="onTransfer"
							>
								Transfer
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div v-if="boardSettingsOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" @click.self="boardSettingsOpen = false" @keydown.esc="boardSettingsOpen = false">
			<div class="flex max-h-[85vh] w-[48rem] max-w-full flex-col border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
				<div class="flex items-center justify-between border-b border-neutral-300 px-5 py-3 dark:border-neutral-700">
					<button
						type="button"
						class="flex items-center gap-1 text-sm text-blue-700 hover:bg-neutral-100 focus:outline-none dark:text-blue-400 dark:hover:bg-neutral-800"
						@click="backToWorkspaceSettings"
					>
						<ChevronLeft :size="16" />
						Back
					</button>
					<div class="flex items-center">
						<button
							v-if="board"
							type="button"
							:aria-label="board.is_favorite ? 'Remove board from favorites' : 'Add board to favorites'"
							:title="board.is_favorite ? 'Remove from favorites' : 'Add to favorites'"
							class="flex h-8 w-8 items-center justify-center focus:outline-none"
							:class="
								board.is_favorite
									? 'text-blue-700 dark:text-blue-400'
									: 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200'
							"
							@click="toggleBoardFavorite(board.id)"
						>
							<Star
								:size="16"
								:fill="board.is_favorite ? 'currentColor' : 'none'"
							/>
						</button>
						<div data-menu="pageMenu" class="relative">
							<button
								v-if="board && canEdit && !board.is_main"
								type="button"
								:aria-label="'Board actions'"
								class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
								@click="pageMenu = pageMenu === 'board' ? null : 'board'"
							>
								<MoreHorizontal :size="16" />
							</button>
							<div
								v-if="board && pageMenu === 'board'"
								class="absolute right-0 top-full z-30 mt-1 w-48 border border-neutral-300 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
							>
								<button
									type="button"
									class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus:outline-none dark:text-neutral-300 dark:hover:bg-neutral-800"
									@click="pageMenu = null; onDeleteBoard(board.id)"
								>
									Delete board
								</button>
							</div>
						</div>
						<button
							type="button"
							class="flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
							aria-label="Close"
							@click="boardSettingsOpen = false"
						>
							✕
						</button>
					</div>
				</div>
				<div class="flex-1 overflow-y-auto p-5">
					<h2 class="text-lg text-neutral-900 dark:text-neutral-100">
						Board settings
					</h2>
					<p v-if="actionError" class="mt-3 text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>

					<div class="mt-4 flex flex-col gap-4">
						<div class="flex flex-col gap-1">
							<label for="edit_board_name" class="text-sm">Board name</label>
							<input
								id="edit_board_name"
								v-model="boardNameInput"
								type="text"
								maxlength="80"
								autocomplete="off"
								:disabled="!canEdit"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@blur="onSaveBoardName"
							/>
						</div>
						<div v-if="canEdit" class="mt-1 flex items-center gap-3">
							<button
								type="button"
								:disabled="savingBoardSettings"
								class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
								@click="onSaveBoardSettings"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
