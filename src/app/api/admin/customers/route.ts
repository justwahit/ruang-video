import { hashPassword } from '@/lib/password'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'
import { customerCreateSchema } from '@/lib/validation/customer'
import { requireRole } from '@/lib/auth'

const customerSelect = {
  id: true,
  name: true,
  username: true,
  createdAt: true,
} as const

export async function GET(request: Request) {
  void request.url
  try {
    await requireRole('admin')
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      select: customerSelect,
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ customers })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireRole('admin')
    const input = customerCreateSchema.parse(await request.json())
    const { password, ...details } = input
    const customer = await prisma.user.create({
      data: {
        ...details,
        passwordHash: await hashPassword(password),
        role: 'customer',
      },
      select: customerSelect,
    })
    return Response.json({ customer }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
