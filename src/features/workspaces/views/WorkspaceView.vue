<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { WorkspaceDetail, WorkspaceMember } from '@/shared/types'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import {
  addMember,
  deleteWorkspace,
  getWorkspace,
  removeMember,
  transferOwner,
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

const workspaceId = computed(() => String(route.params.id))
const detail = ref<WorkspaceDetail | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const savingError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const saved = ref(false)

const actorId = auth.user?.id ?? ''

const canEdit = computed(() => detail.value?.role === 'owner' || detail.value?.role === 'editor')
const canManage = computed(() => detail.value?.role === 'owner')

const form = reactive<WorkspaceFormValues>({ name: '', description: '' })
const formValidation = ref<Partial<Record<keyof WorkspaceFormValues, string>>>({})

const memberForm = reactive<AddMemberValues>({ login: '', role: 'viewer' })
const memberValidation = ref<Partial<Record<keyof AddMemberValues, string>>>({})

const transferTarget = ref('')

async function load() {
  loading.value = true
  loadError.value = null
  actionError.value = null
  try {
    detail.value = await getWorkspace(workspaceId.value)
    form.name = detail.value.name
    form.description = detail.value.description
    if (transferTarget.value !== detail.value.id) {
      const firstTarget = detail.value.members.find((m) => m.id !== actorId)
      transferTarget.value = firstTarget?.id ?? ''
    }
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    loading.value = false
  }
}

async function onSave() {
  const result = workspaceFormSchema.safeParse(form)
  if (!result.success) {
    formValidation.value = collectErrors(result.error.issues)
    return
  }
  formValidation.value = {}
  savingError.value = null
  saved.value = false
  try {
    await updateWorkspace(workspaceId.value, result.data)
    saved.value = true
    await load()
  } catch (e) {
    savingError.value = extractError(e)
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

async function onDelete() {
  if (!window.confirm(`Delete workspace ${detail.value?.name}?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteWorkspace(workspaceId.value)
    await router.push('/workspaces')
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function canRemove(member: WorkspaceMember): boolean {
  if (member.role === 'owner') {
    return false
  }
  return canManage.value
}

const transferCandidates = computed(() => {
  return detail.value?.members.filter((m) => m.id !== actorId) ?? []
})

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

onMounted(load)
watch(workspaceId, load)
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8">
		<h1 class="mb-6 text-xl text-neutral-900 dark:text-neutral-100">Workspace</h1>

		<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
		<div v-else-if="detail" class="flex flex-col gap-6">
			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<div class="mb-4 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<h2 class="text-lg text-neutral-900 dark:text-neutral-100">{{ detail.name }}</h2>
						<span class="border border-neutral-300 px-2 py-0.5 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
							{{ detail.role }}
						</span>
					</div>
					<RouterLink
						to="/workspaces"
						class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
					>
						Back
					</RouterLink>
				</div>
				<p v-if="detail.description" class="text-sm text-neutral-600 dark:text-neutral-400">
					{{ detail.description }}
				</p>

				<template v-if="canEdit">
					<form class="mt-4 flex flex-col gap-4" novalidate @submit.prevent="onSave">
						<div class="flex flex-col gap-1">
							<label for="edit_name" class="text-sm">Name</label>
							<input
								id="edit_name"
								v-model="form.name"
								type="text"
								autocomplete="off"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearFormError('name')"
							/>
							<p v-if="formValidation.name" class="text-sm text-blue-700 dark:text-blue-400">
								{{ formValidation.name }}
							</p>
						</div>
						<div class="flex flex-col gap-1">
							<label for="edit_description" class="text-sm">Description</label>
							<textarea
								id="edit_description"
								v-model="form.description"
								rows="2"
								autocomplete="off"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
								@input="clearFormError('description')"
							/>
							<p v-if="formValidation.description" class="text-sm text-blue-700 dark:text-blue-400">
								{{ formValidation.description }}
							</p>
						</div>
						<button
							type="submit"
							class="max-w-xs bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
						>
							Save
						</button>
						<p v-if="savingError" class="text-sm text-blue-700 dark:text-blue-400">{{ savingError }}</p>
						<p v-if="saved" class="text-sm text-blue-700 dark:text-blue-400">Workspace updated</p>
					</form>
				</template>
			</section>

			<section v-if="canManage" class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Add member</h2>
				<form class="flex flex-col gap-4" novalidate @submit.prevent="onAddMember">
					<div class="flex flex-col gap-1">
						<label for="member_login" class="text-sm">Login</label>
						<input
							id="member_login"
							v-model="memberForm.login"
							type="text"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearMemberError('login')"
						/>
						<p v-if="memberValidation.login" class="text-sm text-blue-700 dark:text-blue-400">
							{{ memberValidation.login }}
						</p>
					</div>
					<div class="flex flex-col gap-1">
						<label for="member_role" class="text-sm">Role</label>
						<select
							id="member_role"
							v-model="memberForm.role"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
						>
							<option value="editor">editor</option>
							<option value="viewer">viewer</option>
						</select>
					</div>
					<button
						type="submit"
						class="max-w-xs bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
					>
						Add member
					</button>
				</form>
			</section>

			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Members</h2>
				<p v-if="actionError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-neutral-300 text-left text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
							<th class="py-2 pr-4">Name</th>
							<th class="py-2 pr-4">Login</th>
							<th class="py-2 pr-4">Role</th>
							<th class="py-2 pr-4">Joined</th>
							<th class="py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="member in detail.members"
							:key="member.id"
							class="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
						>
							<td class="py-2 pr-4 text-neutral-900 dark:text-neutral-100">{{ member.display_name }}</td>
							<td class="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ member.login }}</td>
							<td class="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ member.role }}</td>
							<td class="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ member.joined_at.slice(0, 10) }}</td>
							<td class="py-2">
								<button
									v-if="canRemove(member)"
									type="button"
									class="border border-blue-700 px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
									@click="onRemoveMember(member)"
								>
									Remove
								</button>
							</td>
						</tr>
					</tbody>
				</table>

				<template v-if="canManage">
					<div class="mt-4 flex items-end gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
						<div class="flex flex-col gap-1">
							<label for="transfer_target" class="text-sm">Transfer ownership</label>
							<select
								id="transfer_target"
								v-model="transferTarget"
								class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							>
								<option v-for="m in transferCandidates" :key="m.id" :value="m.id">
									{{ m.display_name }} ({{ m.login }})
								</option>
							</select>
						</div>
						<button
							type="button"
							class="border border-blue-700 px-4 py-2 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
							:disabled="!transferTarget"
							@click="onTransfer"
						>
							Transfer ownership
						</button>
						<button
							type="button"
							class="border border-blue-700 px-4 py-2 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
							@click="onDelete"
						>
							Delete workspace
						</button>
					</div>
				</template>
			</section>
		</div>
	</div>
</template>