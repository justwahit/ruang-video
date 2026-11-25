import { z } from 'zod'

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter.')
  .max(64, 'Username maksimal 64 karakter.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.')
  .transform((username) => username.toLowerCase())

const nameSchema = z.string().trim().min(2, 'Nama minimal 2 karakter.').max(100)

export const customerCreateSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: z.string().min(10, 'Password minimal 10 karakter.').max(128),
})

export const customerUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    username: usernameSchema.optional(),
    password: z.string().min(10, 'Password minimal 10 karakter.').max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu data customer harus diperbarui.',
  })
