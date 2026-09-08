<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { extractError } from '@/shared/utils/error'
import { useAuthStore } from '@/stores/auth'
import AvatarUpload from '../components/AvatarUpload.vue'
import ChangePasswordForm from '../components/ChangePasswordForm.vue'
import ProfileForm from '../components/ProfileForm.vue'
import type { ChangePasswordFormValues, UpdateProfileFormValues } from '../schema'

const auth = useAuthStore()
const router = useRouter()

const profileError = ref<string | null>(null)
const profileSaved = ref(false)
const avatarError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const passwordSaved = ref(false)
const profileSubmitting = ref(false)
const avatarSubmitting = ref(false)
const passwordSubmitting = ref(false)

async function onUpdateProfile(values: UpdateProfileFormValues) {
  profileError.value = null
  profileSaved.value = false
  profileSubmitting.value = true
  try {
    await auth.updateProfile(values)
    profileSaved.value = true
  } catch (e) {
    profileError.value = extractError(e)
  } finally {
    profileSubmitting.value = false
  }
}

async function onUploadAvatar(file: File) {
  avatarError.value = null
  avatarSubmitting.value = true
  try {
    await auth.uploadAvatar(file)
  } catch (e) {
    avatarError.value = extractError(e)
  } finally {
    avatarSubmitting.value = false
  }
}

async function onChangePassword(values: ChangePasswordFormValues) {
  passwordError.value = null
  passwordSaved.value = false
  passwordSubmitting.value = true
  try {
    await auth.changePassword({
      new_password: values.new_password,
      current_password: values.current_password,
    })
    passwordSaved.value = true
  } catch (e) {
    passwordError.value = extractError(e)
  } finally {
    passwordSubmitting.value = false
  }
}
</script>

<template>
	<div class="px-3 py-4 sm:px-4 md:px-6">
		<div class="mb-6 flex items-center">
			<div class="flex w-1/3 items-center justify-start">
				<button
					type="button"
					class="flex h-9 w-9 items-center justify-center border border-neutral-300 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
					aria-label="Back to home"
					@click="router.push('/')"
				>
					<ArrowLeft class="h-4 w-4" />
				</button>
			</div>
			<div class="flex w-1/3 items-center justify-center">
				<h1 class="text-xl text-neutral-900 dark:text-neutral-100">Profile</h1>
			</div>
			<div class="flex w-1/3 items-center justify-end"></div>
		</div>

		<div class="flex flex-col gap-6">
			<section class="flex items-center gap-4 border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<AvatarUpload :avatar-key="auth.user?.avatar_key ?? ''" :submitting="avatarSubmitting" @upload="onUploadAvatar" />
			</section>
			<p v-if="avatarError" class="text-sm text-blue-700 dark:text-blue-400">{{ avatarError }}</p>

			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Basic info</h2>
				<ProfileForm
					:display-name="auth.user?.display_name ?? ''"
					:bio="auth.user?.bio ?? ''"
					:submitting="profileSubmitting"
					@submit="onUpdateProfile"
				/>
				<p v-if="profileError" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ profileError }}</p>
				<p v-if="profileSaved" class="mt-4 text-sm text-blue-700 dark:text-blue-400">Profile saved</p>
			</section>

			<section class="border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
				<h2 class="mb-4 text-lg text-neutral-900 dark:text-neutral-100">Change password</h2>
				<ChangePasswordForm :submitting="passwordSubmitting" @submit="onChangePassword" />
				<p v-if="passwordError" class="mt-4 text-sm text-blue-700 dark:text-blue-400">{{ passwordError }}</p>
				<p v-if="passwordSaved" class="mt-4 text-sm text-blue-700 dark:text-blue-400">Password updated</p>
			</section>
		</div>
	</div>
</template>