import { z } from 'zod'

const loginSchemaString = z
  .string()
  .trim()
  .min(3, 'login must be at least 3 characters')
  .max(50, 'login must be at most 50 characters')
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    'login may contain lowercase letters, digits, dots, dashes and underscores',
  )

export const loginSchema = z.object({
  login: loginSchemaString,
  password: z.string().min(1, 'password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
