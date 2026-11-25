import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AccessRequestError } from '@/lib/access/requests'
import { AuthorizationError } from '@/lib/auth'
import { VideoStorageError } from '@/lib/storage/videos'

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return Response.json(
      { error: error.status === 401 ? 'Silakan masuk terlebih dahulu.' : 'Akses tidak diizinkan.' },
      { status: error.status },
    )
  }
  if (error instanceof AccessRequestError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof VideoStorageError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? 'Data yang dikirim tidak valid.' },
      { status: 400 },
    )
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'Data tersebut sudah digunakan.' }, { status: 409 })
    }
    if (error.code === 'P2025') {
      return Response.json({ error: 'Data tidak ditemukan.' }, { status: 404 })
    }
  }

  console.error('Unhandled API error:', error)
  return Response.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
}
