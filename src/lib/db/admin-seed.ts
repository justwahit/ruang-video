import { hash } from 'bcryptjs'
import { z } from 'zod'

const adminCredentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/)
    .transform((username) => username.toLowerCase()),
  password: z.string().min(12).max(128),
})

export async function createAdminSeedData(credentials: {
  username: string
  password: string
}) {
  const { username, password } = adminCredentialsSchema.parse(credentials)

  return {
    name: username,
    username,
    passwordHash: await hash(password, 12),
    role: 'admin',
  }
}
