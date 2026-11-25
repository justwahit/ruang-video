import { z } from 'zod'

export const videoMetadataSchema = z.object({
  title: z.string().trim().min(2, 'Judul minimal 2 karakter.').max(120),
  description: z.string().trim().max(2000).default(''),
})
