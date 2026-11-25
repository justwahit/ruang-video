import { z } from 'zod'

export const roleSchema = z.enum(['admin', 'customer'])

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((username) => username.toLowerCase()),
  password: z.string().min(1).max(128),
})
