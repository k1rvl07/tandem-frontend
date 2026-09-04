import { z } from 'zod'

const emailSchema = z.string().trim().email('invalid email format')

const passwordSchema = z.string().min(8, 'password must be at least 8 characters')

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'passwords do not match',
    path: ['confirm_password'],
  })

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
export type LoginFormValues = z.infer<typeof loginSchema>
