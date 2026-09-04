import { z } from 'zod'

export const addableRoles = ['editor', 'viewer'] as const

export const workspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80, 'name must be at most 80 characters'),
  description: z.string().trim().max(400, 'description must be at most 400 characters'),
})

export const addMemberSchema = z.object({
  login: z.string().trim().min(1, 'login is required'),
  role: z.enum(addableRoles).default('viewer'),
})

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>
export type AddMemberValues = z.infer<typeof addMemberSchema>
