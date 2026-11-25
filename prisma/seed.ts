import { PrismaClient } from '@prisma/client'
import { createAdminSeedData } from '../src/lib/db/admin-seed'

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set before seeding.')
  }

  const data = await createAdminSeedData({ username, password })
  const prisma = new PrismaClient()

  try {
    await prisma.user.upsert({
      where: { username: data.username },
      update: {
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role,
      },
      create: data,
    })
  } finally {
    await prisma.$disconnect()
  }
}

main()
