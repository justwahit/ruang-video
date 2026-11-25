import { redirect } from 'next/navigation'
import { VideoCatalog } from '@/components/customer/video-catalog'
import { WorkspaceShell } from '@/components/workspace-shell'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function VideosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'customer') redirect('/admin')

  const now = new Date()
  const [videos, pendingRequests, activeGrants] = await Promise.all([
    prisma.video.findMany({
      select: { id: true, title: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.accessRequest.findMany({
      where: { customerId: user.id, status: 'pending' },
      select: { videoId: true },
    }),
    prisma.videoGrant.findMany({
      where: {
        customerId: user.id,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: { videoId: true, expiresAt: true },
    }),
  ])
  const pendingIds = new Set(pendingRequests.map((request) => request.videoId))
  const grantExpiry = new Map(
    activeGrants.map((grant) => [grant.videoId, grant.expiresAt.toISOString()]),
  )

  return (
    <WorkspaceShell
      role="customer"
      userName={user.name}
      activePath="/videos"
      eyebrow="Katalog video"
      title="Video untuk Anda"
      description="Ajukan izin untuk mulai menonton video."
    >
      <VideoCatalog
        initialVideos={videos.map((video) => ({
          ...video,
          createdAt: video.createdAt.toISOString(),
          pendingRequest: pendingIds.has(video.id),
          grantExpiresAt: grantExpiry.get(video.id) ?? null,
        }))}
      />
    </WorkspaceShell>
  )
}
