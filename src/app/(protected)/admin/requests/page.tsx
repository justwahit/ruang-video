import { redirect } from 'next/navigation'
import { RequestReview } from '@/components/admin/request-review'
import { WorkspaceShell } from '@/components/workspace-shell'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminRequestsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/videos')

  const requests = await prisma.accessRequest.findMany({
    include: {
      customer: { select: { id: true, name: true, username: true } },
      video: { select: { id: true, title: true } },
      grant: { select: { startsAt: true, expiresAt: true } },
    },
    orderBy: { requestedAt: 'desc' },
  })

  return (
    <WorkspaceShell
      role="admin"
      userName={user.name}
      activePath="/admin/requests"
      eyebrow="Persetujuan"
      title="Permintaan akses"
      description="Tentukan durasi izin atau tolak permintaan customer."
    >
      <RequestReview
        initialRequests={requests.map((request) => ({
          ...request,
          requestedAt: request.requestedAt.toISOString(),
          decidedAt: request.decidedAt?.toISOString() ?? null,
          grant: request.grant
            ? {
                startsAt: request.grant.startsAt.toISOString(),
                expiresAt: request.grant.expiresAt.toISOString(),
              }
            : null,
        }))}
      />
    </WorkspaceShell>
  )
}
