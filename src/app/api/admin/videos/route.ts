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

export async function GET(request: Request) {
  void request.url
  try {
    await requireRole('admin')
    const videos = await prisma.video.findMany({
      select: videoSelect,
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ videos })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireRole('admin')
    const formData = await request.formData()
    const metadata = videoMetadataSchema.parse({
      title: formData.get('title'),
      description: formData.get('description') ?? '',
    })
    const file = formData.get('video')
    if (!(file instanceof File)) {
      return Response.json({ error: 'Pilih file video untuk diunggah.' }, { status: 400 })
    }

    const stored = await storeVideo(file)
    let video
    try {
      video = await prisma.video.create({
        data: { ...metadata, ...stored },
        select: videoSelect,
      })
    } catch (error) {
      try {
        await deleteStoredVideo(stored.storageKey)
      } catch (cleanupError) {
        console.error('Failed to clean up an upload after database creation failed:', cleanupError)
      }
      throw error
    }
    return Response.json({ video }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
