import { open } from 'node:fs/promises'
import { requireRole } from '@/lib/auth'
import { hasActiveGrant } from '@/lib/access/requests'
import { prisma } from '@/lib/db'
import { apiErrorResponse } from '@/lib/http'
import { ByteRangeError, parseRangeHeader } from '@/lib/media/range'
import { resolveStoredVideoPath } from '@/lib/storage/videos'

type RouteContext = { params: Promise<{ videoId: string }> }

function isMissingFile(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT',
  )
}

export async function GET(request: Request, context: RouteContext) {
  let file: Awaited<ReturnType<typeof open>> | undefined
  try {
    const customer = await requireRole('customer')
    const { videoId } = await context.params
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { storageKey: true, mimeType: true },
    })
    if (!video) {
      return Response.json({ error: 'Video tidak ditemukan.' }, { status: 404 })
    }

    if (!(await hasActiveGrant(customer.id, videoId, new Date()))) {
      return Response.json({ error: 'Izin menonton video ini tidak aktif.' }, { status: 403 })
    }

    file = await open(resolveStoredVideoPath(video.storageKey), 'r')
    const { size } = await file.stat()
    let range
    try {
      range = parseRangeHeader(request.headers.get('range'), size)
    } catch (error) {
      if (!(error instanceof ByteRangeError)) throw error
      await file.close()
      file = undefined
      return new Response(null, {
        status: 416,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${size}`,
        },
      })
    }

    const contentLength = range
      ? range.end - range.start + 1
      : size
    const nodeStream =
      size === 0
        ? file.createReadStream()
        : file.createReadStream({
            start: range?.start ?? 0,
            end: range?.end ?? size - 1,
          })
    file = undefined

    const body = new ReadableStream<Uint8Array>({
          start(controller) {
            nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
            nodeStream.on('end', () => controller.close())
            nodeStream.on('error', (error) => controller.error(error))
          },
          cancel() {
            nodeStream.destroy()
          },
    })

    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'Content-Length': String(contentLength),
        'Content-Type': video.mimeType,
        'X-Content-Type-Options': 'nosniff',
        ...(range
          ? {
              'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
            }
          : {}),
      },
    })
  } catch (error) {
    if (file) await file.close()
    if (isMissingFile(error)) {
      return Response.json({ error: 'File video tidak ditemukan.' }, { status: 404 })
    }
    return apiErrorResponse(error)
  }
}
