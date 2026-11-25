import { z } from 'zod'
import { decideAccessRequest } from '@/lib/access/requests'
import { requireRole } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http'

const noteSchema = z.string().trim().max(1000).optional()
const decisionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('approved'),
    durationHours: z.number().int().positive(),
    note: noteSchema,
  }),
  z.object({
    status: z.literal('rejected'),
    note: noteSchema,
  }),
])

type RouteContext = { params: Promise<{ requestId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireRole('admin')
    const { requestId } = await context.params
    const decision = decisionSchema.parse(await request.json())
    const accessRequest = await decideAccessRequest(requestId, admin.id, decision)
    return Response.json({ request: accessRequest })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
