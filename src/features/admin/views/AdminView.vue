<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { User, UserRole } from '@/shared/types'
import TagSelect from '@/shared/ui/TagSelect.vue'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import { createUser, deleteUser, listUsers, updateUserRole } from '../api'
import { type CreateUserFormValues, createUserSchema } from '../schema'

const auth = useAuthStore()
const router = useRouter()
const users = ref<User[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const searchInput = ref('')
const q = ref('')
const loadError = ref<string | null>(null)
const createError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const created = ref(false)
const creating = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const hasMore = () => users.value.length < total.value

const actorId = auth.user?.id ?? ''
const actorRole = auth.user?.role ?? 'user'
const isAdmin = actorRole === 'admin'

const availableRoles: UserRole[] = actorRole === 'admin' ? ['user', 'moderator'] : ['user']
const roleOptions = availableRoles.map((role) => ({ label: role, value: role }))

const values = reactive<CreateUserFormValues>({
  login: '',
  password: '',
  display_name: '',
  role: 'user',
})

const validationErrors = ref<Partial<Record<keyof CreateUserFormValues, string>>>({})

async function load() {
  if (loading.value || loadingMore.value) {
    return
  }
  if (page.value === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }
  loadError.value = null
  try {
    const res = await listUsers(page.value, pageSize, q.value)
    total.value = res.total
    users.value = page.value === 1 ? res.items : [...users.value, ...res.items]
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function reset() {
  users.value = []
  total.value = 0
  page.value = 1
  void load()
}

function onScroll() {
  const el = scrollRef.value
  if (!el || loading.value || loadingMore.value || !hasMore()) {
    return
  }
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
    page.value += 1
    void load()
  }
}

function onSearchInput() {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer)
  }
  searchTimer = window.setTimeout(() => {
    q.value = searchInput.value.trim()
    reset()
  }, 300)
}

async function onCreateUser() {
  const result = createUserSchema.safeParse(values)
  if (!result.success) {
    validationErrors.value = collectErrors(result.error.issues)
    return
  }
  validationErrors.value = {}
  createError.value = null
  created.value = false
  creating.value = true
  try {
    await createUser(result.data)
    created.value = true
    values.login = ''
    values.password = ''
    values.display_name = ''
    values.role = availableRoles[0]
    reset()
  } catch (e) {
    createError.value = extractError(e)
  } finally {
    creating.value = false
  }
}

async function onDelete(user: User) {
  if (!window.confirm(`Delete ${user.login}?`)) {
    return
  }
  actionError.value = null
  try {
    await deleteUser(user.id)
    reset()
  } catch (e) {
    actionError.value = extractError(e)
  }
}

async function onRoleChange(user: User, role: UserRole) {
  actionError.value = null
  try {
    const updated = await updateUserRole(user.id, role)
    user.role = updated.role
  } catch (e) {
    actionError.value = extractError(e)
  }
}

function canDelete(user: User): boolean {
  if (user.id === actorId) {
    return false
  }
  if (user.role === 'admin') {
    return false
  }
  if (actorRole === 'moderator' && user.role !== 'user') {
    return false
  }
  return true
}

function clearError(field: keyof CreateUserFormValues) {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer)
  }
})
</script>

<template>
	<div class="px-3 py-4 sm:px-4 md:px-6">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-xl text-neutral-900 dark:text-neutral-100">Admin panel</h1>
			<button
				type="button"
				class="border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
				@click="router.push('/')"
			>
				Back
			</button>
		</div>

		<div class="flex flex-col gap-6">
			<section v-if="isAdmin" class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Create user</h2>
				<form class="flex flex-col gap-4" novalidate @submit.prevent="onCreateUser">
					<div class="flex flex-col gap-1">
						<label for="login" class="text-sm">Login</label>
						<input
							id="login"
							v-model="values.login"
							type="text"
							maxlength="50"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearError('login')"
						/>
						<p v-if="validationErrors.login" class="text-sm text-blue-700 dark:text-blue-400">
							{{ validationErrors.login }}
						</p>
					</div>

					<div class="flex flex-col gap-1">
						<label for="display_name" class="text-sm">Display name</label>
						<input
							id="display_name"
							v-model="values.display_name"
							type="text"
							maxlength="50"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearError('display_name')"
						/>
						<p v-if="validationErrors.display_name" class="text-sm text-blue-700 dark:text-blue-400">
							{{ validationErrors.display_name }}
						</p>
					</div>

					<div class="flex flex-col gap-1">
						<label for="password" class="text-sm">Password</label>
						<input
							id="password"
							v-model="values.password"
							type="text"
							maxlength="72"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearError('password')"
						/>
						<p v-if="validationErrors.password" class="text-sm text-blue-700 dark:text-blue-400">
							{{ validationErrors.password }}
						</p>
					</div>

					<div class="flex flex-col gap-1">
						<label for="role" class="text-sm">Role</label>
						<TagSelect v-model="values.role" :options="roleOptions" />
					</div>

					<button
						type="submit"
						:disabled="creating"
						class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
					>
						{{ creating ? 'Creating...' : 'Create user' }}
					</button>
				</form>
				<p v-if="createError" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ createError }}</p>
				<p v-if="created" class="mt-4 text-sm text-blue-700 dark:text-blue-400">User created</p>
			</section>

			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<div class="mb-4 flex items-center justify-between gap-4">
					<h2 class="text-lg text-neutral-900 dark:text-neutral-100">Users</h2>
					<input
						v-model="searchInput"
						type="text"
						maxlength="50"
						autocomplete="off"
						placeholder="Search by login"
						class="w-56 border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
						@input="onSearchInput"
					/>
				</div>
				<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
				<p v-if="actionError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>
				<p v-if="loading" class="px-3 py-4 text-sm text-neutral-600 dark:text-neutral-400">Loading...</p>
				<div
					v-else
					ref="scrollRef"
					class="max-h-80 overflow-y-auto"
					@scroll="onScroll"
				>
					<table v-if="users.length > 0" class="w-full text-sm">
						<thead>
							<tr class="sticky top-0 z-[70] border-b border-neutral-300 bg-white text-left text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
								<th class="whitespace-nowrap py-2 pr-4">Login</th>
								<th class="whitespace-nowrap py-2 pr-4">Display name</th>
								<th class="whitespace-nowrap py-2 pr-4">Role</th>
								<th class="whitespace-nowrap py-2 pr-4">Created</th>
								<th class="whitespace-nowrap py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="user in users"
								:key="user.id"
								class="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
							>
								<td class="max-w-48 truncate whitespace-nowrap py-2 pr-4 text-neutral-900 dark:text-neutral-100" :title="user.login">{{ user.login }}</td>
								<td class="max-w-80 truncate whitespace-nowrap py-2 pr-4 text-neutral-900 dark:text-neutral-100" :title="user.display_name">{{ user.display_name }}</td>
								<td class="whitespace-nowrap py-2 pr-4 text-neutral-600 dark:text-neutral-400">
									<TagSelect
										v-if="isAdmin && user.role !== 'admin'"
										:model-value="user.role"
										:options="roleOptions"
										compact
										value-max-w="max-w-36"
										@update:model-value="(role) => onRoleChange(user, role)"
									/>
									<span v-else class="whitespace-nowrap">{{ user.role }}</span>
								</td>
								<td class="whitespace-nowrap py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ user.created_at.slice(0, 10) }}</td>
								<td class="whitespace-nowrap py-2">
									<button
										v-if="canDelete(user)"
										type="button"
										class="border border-blue-700 px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-neutral-800"
										@click="onDelete(user)"
									>
										Delete
									</button>
								</td>
							</tr>
						</tbody>
					</table>
					<p v-else class="px-3 py-4 text-sm text-neutral-600 dark:text-neutral-400">No users found.</p>
				</div>
				<p v-if="loadingMore" class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Loading more...</p>
				<p v-if="users.length > 0" class="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
					{{ total }} user(s)
				</p>
			</section>
		</div>
	</div>
</template>