import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export class AccessRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message)
    this.name = 'AccessRequestError'
  }
}

export type AccessDecision =
  | { status: 'approved'; durationHours: number; note?: string }
  | { status: 'rejected'; note?: string }

function assertDurationHours(durationHours: number): void {
  if (!Number.isSafeInteger(durationHours) || durationHours <= 0) {
    throw new AccessRequestError('Durasi akses harus berupa jumlah jam positif.', 400)
  }
}

function assertValidDate(date: Date): void {
  if (!Number.isFinite(date.getTime())) {
    throw new AccessRequestError('Durasi akses terlalu besar.', 400)
  }
}

export async function hasActiveGrant(
  customerId: string,
  videoId: string,
  at: Date,
): Promise<boolean> {
  const grant = await prisma.videoGrant.findFirst({
    where: {
      customerId,
      videoId,
      startsAt: { lte: at },
      expiresAt: { gt: at },
    },
    select: { id: true },
  })
  return grant !== null
}

export async function createAccessRequest(
  customerId: string,
  videoId: string,
): Promise<Prisma.AccessRequestGetPayload<{ include: { grant: true } }>> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const customer = await transaction.user.findUnique({
        where: { id: customerId },
        select: { role: true },
      })
      if (!customer || customer.role !== 'customer') {
        throw new AccessRequestError('Customer tidak ditemukan.', 404)
      }

      const video = await transaction.video.findUnique({
        where: { id: videoId },
        select: { id: true },
      })
      if (!video) throw new AccessRequestError('Video tidak ditemukan.', 404)

      const pendingRequest = await transaction.accessRequest.findFirst({
        where: { customerId, videoId, status: 'pending' },
        select: { id: true },
      })
      if (pendingRequest) {
        throw new AccessRequestError('Permintaan akses untuk video ini masih menunggu.', 409)
      }

      const now = new Date()
      const activeGrant = await transaction.videoGrant.findFirst({
        where: {
          customerId,
          videoId,
          startsAt: { lte: now },
          expiresAt: { gt: now },
        },
        select: { id: true },
      })
      if (activeGrant) {
        throw new AccessRequestError('Anda masih memiliki izin aktif untuk video ini.', 409)
      }

      return transaction.accessRequest.create({
        data: {
          customerId,
          videoId,
          status: 'pending',
          pendingKey: `${customerId}:${videoId}`,
        },
        include: { grant: true },
      })
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AccessRequestError('Permintaan akses untuk video ini masih menunggu.', 409)
    }
    throw error
  }
}

export async function decideAccessRequest(
  requestId: string,
  adminId: string,
  decision: AccessDecision,
): Promise<Prisma.AccessRequestGetPayload<{ include: { grant: true } }>> {
  if (decision.status === 'approved') assertDurationHours(decision.durationHours)
  const note = decision.note?.trim() || null
  if (note && note.length > 1000) {
    throw new AccessRequestError('Catatan admin maksimal 1000 karakter.', 400)
  }

  return prisma.$transaction(async (transaction) => {
    const admin = await transaction.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    })
    if (!admin || admin.role !== 'admin') {
      throw new AccessRequestError('Admin tidak ditemukan.', 403)
    }

    const request = await transaction.accessRequest.findUnique({
      where: { id: requestId },
      include: { grant: true },
    })
    if (!request) throw new AccessRequestError('Permintaan tidak ditemukan.', 404)
    if (request.status !== 'pending') {
      throw new AccessRequestError('Permintaan ini sudah diputuskan.', 409)
    }

    const now = new Date()
    if (decision.status === 'rejected') {
      return transaction.accessRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          pendingKey: null,
          decidedAt: now,
          decidedById: adminId,
          adminNote: note,
        },
        include: { grant: true },
      })
    }

    const activeGrant = await transaction.videoGrant.findFirst({
      where: {
        customerId: request.customerId,
        videoId: request.videoId,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: { id: true },
    })
    if (activeGrant) {
      throw new AccessRequestError('Customer masih memiliki izin aktif untuk video ini.', 409)
    }

    const expiresAt = new Date(now.getTime() + decision.durationHours * 60 * 60 * 1000)
    assertValidDate(expiresAt)

    const updatedRequest = await transaction.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        pendingKey: null,
        decidedAt: now,
        decidedById: adminId,
        adminNote: note,
      },
    })
    const grant = await transaction.videoGrant.create({
      data: {
        requestId: updatedRequest.id,
        customerId: updatedRequest.customerId,
        videoId: updatedRequest.videoId,
        approvedById: adminId,
        startsAt: now,
        expiresAt,
      },
    })

    return { ...updatedRequest, grant }
  })
}
