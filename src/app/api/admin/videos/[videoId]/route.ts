import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'
import { deleteStoredVideo, storeVideo } from '@/lib/storage/videos'
import { videoMetadataSchema } from '@/lib/validation/video'

const videoSelect = {
  id: true,
  title: true,
  description: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const

type RouteContext = { params: Promise<{ videoId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { videoId } = await context.params
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: videoSelect,
    })
    if (!video) return Response.json({ error: 'Video tidak ditemukan.' }, { status: 404 })
    return Response.json({ video })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { videoId } = await context.params
    const existing = await prisma.video.findUnique({ where: { id: videoId } })
    if (!existing) return Response.json({ error: 'Video tidak ditemukan.' }, { status: 404 })

    const formData = await request.formData()
    const metadata = videoMetadataSchema.parse({
      title: formData.get('title'),
      description: formData.get('description') ?? '',
    })
    const file = formData.get('video')
    if (typeof file === 'string') {
      return Response.json({ error: 'File video tidak valid.' }, { status: 400 })
    }
    const replacementFile = file instanceof File && file.name.length > 0 ? file : null
    const stored = replacementFile ? await storeVideo(replacementFile) : null

    let video
    try {
      video = await prisma.video.update({
        where: { id: videoId },
        data: {
          ...metadata,
          ...(stored ? stored : {}),
        },
        select: videoSelect,
      })
    } catch (error) {
      if (stored) {
        try {
          await deleteStoredVideo(stored.storageKey)
        } catch (cleanupError) {
          console.error('Failed to clean up a replacement after database update failed:', cleanupError)
        }
      }
      throw error
    }

    if (stored) await deleteStoredVideo(existing.storageKey)
    return Response.json({ video })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireRole('admin')
    const { videoId } = await context.params
    const existing = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, storageKey: true },
    })
    if (!existing) return Response.json({ error: 'Video tidak ditemukan.' }, { status: 404 })

    await prisma.video.delete({ where: { id: videoId } })
    await deleteStoredVideo(existing.storageKey)
    return Response.json({ ok: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
