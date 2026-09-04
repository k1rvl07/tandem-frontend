<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Workspace } from '@/shared/types'
import { extractError } from '@/shared/utils/error'
import { collectErrors } from '@/shared/utils/validation'
import { createWorkspace, listWorkspaces } from '../api'
import { type WorkspaceFormValues, workspaceFormSchema } from '../schema'

const router = useRouter()
const workspaces = ref<Workspace[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const creating = ref(false)
const createError = ref<string | null>(null)

const values = reactive<WorkspaceFormValues>({
  name: '',
  description: '',
})

const validationErrors = ref<Partial<Record<keyof WorkspaceFormValues, string>>>({})

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

async function onCreate() {
  const result = workspaceFormSchema.safeParse(values)
  if (!result.success) {
    validationErrors.value = collectErrors(result.error.issues)
    return
  }
  validationErrors.value = {}
  createError.value = null
  creating.value = true
  try {
    const ws = await createWorkspace(result.data)
    await router.push(`/workspaces/${ws.id}`)
  } catch (e) {
    createError.value = extractError(e)
  } finally {
    creating.value = false
  }
}

function clearError(field: keyof WorkspaceFormValues) {
  if (validationErrors.value[field]) {
    delete validationErrors.value[field]
  }
}

onMounted(load)
</script>

<template>
	<div class="mx-auto max-w-3xl px-4 py-8">
		<h1 class="mb-6 text-xl text-neutral-900 dark:text-neutral-100">Workspaces</h1>

		<div class="flex flex-col gap-6">
			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Create workspace</h2>
				<form class="flex flex-col gap-4" novalidate @submit.prevent="onCreate">
					<div class="flex flex-col gap-1">
						<label for="name" class="text-sm">Name</label>
						<input
							id="name"
							v-model="values.name"
							type="text"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearError('name')"
						/>
						<p v-if="validationErrors.name" class="text-sm text-blue-700 dark:text-blue-400">
							{{ validationErrors.name }}
						</p>
					</div>

					<div class="flex flex-col gap-1">
						<label for="description" class="text-sm">Description</label>
						<textarea
							id="description"
							v-model="values.description"
							rows="2"
							autocomplete="off"
							class="border border-neutral-300 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400"
							@input="clearError('description')"
						/>
						<p v-if="validationErrors.description" class="text-sm text-blue-700 dark:text-blue-400">
							{{ validationErrors.description }}
						</p>
					</div>

					<button
						type="submit"
						:disabled="creating"
						class="bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-neutral-900"
					>
						{{ creating ? 'Creating...' : 'Create workspace' }}
					</button>
				</form>
				<p v-if="createError" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ createError }}</p>
			</section>

			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">My workspaces</h2>
				<p v-if="loadError" class="mb-4 text-sm text-blue-700 dark:text-blue-400">{{ loadError }}</p>
				<p v-if="loading && workspaces.length === 0" class="text-sm text-neutral-600 dark:text-neutral-400">
					Loading...
				</p>
				<template v-else>
					<p
						v-if="workspaces.length === 0"
						class="text-sm text-neutral-600 dark:text-neutral-400"
					>
						No workspaces yet. Create your first one.
					</p>
					<ul v-else class="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
						<li v-for="ws in workspaces" :key="ws.id">
							<button
								type="button"
								class="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-neutral-100 focus:outline-none dark:hover:bg-neutral-800"
								@click="router.push(`/workspaces/${ws.id}`)"
							>
								<span class="text-neutral-900 dark:text-neutral-100">{{ ws.name }}</span>
								<span class="flex items-center gap-3">
									<span v-if="ws.description" class="truncate text-sm text-neutral-500 dark:text-neutral-400">
										{{ ws.description }}
									</span>
									<span class="border border-neutral-300 px-2 py-0.5 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
										{{ ws.role }}
									</span>
								</span>
							</button>
						</li>
					</ul>
				</template>
			</section>
		</div>
	</div>
</template>