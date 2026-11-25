import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'

export async function GET(request: Request) {
  void request.url
  try {
    await requireRole('admin')
    const requests = await prisma.accessRequest.findMany({
      include: {
        customer: { select: { id: true, name: true, username: true } },
        video: { select: { id: true, title: true } },
        grant: true,
      },
      orderBy: { requestedAt: 'desc' },
    })
    return Response.json({ requests })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
