import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAccessRequest } from '@/lib/access/requests'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'

const createRequestSchema = z.object({
  videoId: z.string().min(1).max(64),
})

export async function GET(request: Request) {
  void request.url
  try {
    const customer = await requireRole('customer')
    const requests = await prisma.accessRequest.findMany({
      where: { customerId: customer.id },
      include: {
        video: { select: { id: true, title: true, description: true } },
        grant: true,
      },
      orderBy: { requestedAt: 'desc' },
    })
    return Response.json({ requests })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireRole('customer')
    const input = createRequestSchema.parse(await request.json())
    const accessRequest = await createAccessRequest(customer.id, input.videoId)
    return Response.json({ request: accessRequest }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
