import { z } from 'zod'

export const addableRoles = ['editor', 'member'] as const

export const workspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80, 'name must be at most 80 characters'),
  description: z.string().trim().max(400, 'description must be at most 400 characters'),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (v) => v === '' || /^[A-Z][A-Z0-9-]{0,9}$/.test(v),
      'prefix must start with a letter, contain only A-Z, 0-9 and dashes, max 10 characters',
    )
    .optional(),
})

export const addMemberSchema = z.object({
  login: z.string().trim().min(1, 'login is required'),
  role: z.enum(addableRoles).default('member'),
})

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>
export type AddMemberValues = z.infer<typeof addMemberSchema>
