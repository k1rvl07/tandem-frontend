import { z } from 'zod'

export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'display name is required')
    .max(50, 'display name must be at most 50 characters'),
  bio: z.string().trim().max(400, 'bio must be at most 400 characters'),
})

export const changePasswordSchema = z
  .object({
    new_password: z.string().min(8, 'password must be at least 8 characters'),
    confirm_password: z.string(),
    current_password: z.string().min(1, 'current password is required'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'passwords do not match',
    path: ['confirm_password'],
  })

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
