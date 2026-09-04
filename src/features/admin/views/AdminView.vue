<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { User, UserRole } from '@/shared/types'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { useAuthStore } from '@/stores/auth'
import { createUser, deleteUser, listUsers } from '../api'
import { type CreateUserFormValues, createUserSchema } from '../schema'

const auth = useAuthStore()
const users = ref<User[]>([])
const loadError = ref<string | null>(null)
const createError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const created = ref(false)
const creating = ref(false)
const loading = ref(false)

const actorId = auth.user?.id ?? ''
const actorRole = auth.user?.role ?? 'user'

const availableRoles: UserRole[] = actorRole === 'admin' ? ['user', 'moderator'] : ['user']

const values = reactive<CreateUserFormValues>({
  login: '',
  password: '',
  display_name: '',
  role: 'user',
})

const validationErrors = ref<Partial<Record<keyof CreateUserFormValues, string>>>({})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    users.value = await listUsers()
  } catch (e) {
    loadError.value = extractError(e)
  } finally {
    loading.value = false
  }
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
    await load()
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
    await load()
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

onMounted(load)
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8">
		<h1 class="mb-6 text-xl text-neutral-900 dark:text-neutral-100">Admin panel</h1>

		<div class="flex flex-col gap-6">
			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Create user</h2>
				<form class="flex flex-col gap-4" novalidate @submit.prevent="onCreateUser">
					<div class="flex flex-col gap-1">
						<label for="login" class="text-sm">Login</label>
						<input
							id="login"
							v-model="values.login"
							type="text"
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
						<select
							id="role"
							v-model="values.role"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
						>
							<option v-for="role in availableRoles" :key="role" :value="role">{{ role }}</option>
						</select>
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
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Users</h2>
				<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
				<p v-if="actionError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ actionError }}</p>
				<table v-if="loading" class="w-full text-sm text-neutral-600 dark:text-neutral-400">
					<caption class="text-left">Loading...</caption>
				</table>
				<table v-else class="w-full text-sm">
					<thead>
						<tr class="border-b border-neutral-300 text-left text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
							<th class="py-2 pr-4">Login</th>
							<th class="py-2 pr-4">Display name</th>
							<th class="py-2 pr-4">Role</th>
							<th class="py-2 pr-4">Created</th>
							<th class="py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="user in users"
							:key="user.id"
							class="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
						>
							<td class="py-2 pr-4 text-neutral-900 dark:text-neutral-100">{{ user.login }}</td>
							<td class="py-2 pr-4 text-neutral-900 dark:text-neutral-100">{{ user.display_name }}</td>
							<td class="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ user.role }}</td>
							<td class="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{{ user.created_at.slice(0, 10) }}</td>
							<td class="py-2">
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
			</section>
		</div>
	</div>
</template>