import { hashPassword } from '@/lib/password'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'
import { customerUpdateSchema } from '@/lib/validation/customer'
import { requireRole } from '@/lib/auth'

const customerSelect = {
  id: true,
  name: true,
  username: true,
  createdAt: true,
} as const

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { customerId } = await context.params
    const customer = await prisma.user.findFirst({
      where: { id: customerId, role: 'customer' },
      select: customerSelect,
    })
    if (!customer) return Response.json({ error: 'Customer tidak ditemukan.' }, { status: 404 })
    return Response.json({ customer })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { customerId } = await context.params
    const input = customerUpdateSchema.parse(await request.json())
    const existing = await prisma.user.findFirst({
      where: { id: customerId, role: 'customer' },
      select: { id: true },
    })
    if (!existing) return Response.json({ error: 'Customer tidak ditemukan.' }, { status: 404 })

    const { password, ...details } = input
    const customer = await prisma.user.update({
      where: { id: customerId },
      data: {
        ...details,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
      select: customerSelect,
    })
    return Response.json({ customer })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { customerId } = await context.params
    const existing = await prisma.user.findFirst({
      where: { id: customerId, role: 'customer' },
      select: { id: true },
    })
    if (!existing) return Response.json({ error: 'Customer tidak ditemukan.' }, { status: 404 })
    await prisma.user.delete({ where: { id: customerId } })
    return Response.json({ ok: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
