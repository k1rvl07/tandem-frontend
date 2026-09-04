import { z } from 'zod'

export const userRoles = ['user', 'moderator'] as const

export const createUserSchema = z.object({
  login: z
    .string()
    .trim()
    .min(3, 'login must be at least 3 characters')
    .max(50, 'login must be at most 50 characters')
    .regex(
      /^[a-z0-9][a-z0-9._-]*$/,
      'login may contain lowercase letters, digits, dots, dashes and underscores',
    ),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(72, 'password is too long'),
  display_name: z
    .string()
    .trim()
    .min(1, 'display name is required')
    .max(50, 'display name must be at most 50 characters'),
  role: z.enum(userRoles).default('user'),
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>
