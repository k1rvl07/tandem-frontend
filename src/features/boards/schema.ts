import { z } from 'zod'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const boardFormSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80, 'name must be at most 80 characters'),
})

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title is required')
    .max(120, 'title must be at most 120 characters'),
  description: z.string().trim().max(1500, 'description must be at most 1500 characters'),
  assignee_id: z.string().optional(),
  curator_id: z.string().optional(),
  parent_id: z.string().optional(),
  board_id: z.string().optional(),
  column_id: z.string().optional(),
  is_urgent: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  image_key: z.string().optional(),
  due_date: z
    .string()
    .trim()
    .regex(datePattern, 'due date must be in YYYY-MM-DD format')
    .or(z.literal(''))
    .optional(),
})

export type BoardFormValues = z.infer<typeof boardFormSchema>
export type TaskFormValues = z.infer<typeof taskFormSchema>
