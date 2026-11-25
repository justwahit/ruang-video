import { redirect } from 'next/navigation'
import { RequestList } from '@/components/customer/request-list'
import { WorkspaceShell } from '@/components/workspace-shell'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function CustomerRequestsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'customer') redirect('/admin')

  const requests = await prisma.accessRequest.findMany({
    where: { customerId: user.id },
    include: {
      video: { select: { id: true, title: true, description: true } },
      grant: { select: { startsAt: true, expiresAt: true } },
    },
    orderBy: { requestedAt: 'desc' },
  })

  return (
    <WorkspaceShell
      role="customer"
      userName={user.name}
      activePath="/requests"
      eyebrow="Status akses"
      title="Permintaan saya"
      description="Pantau keputusan admin dan tenggang waktu izin menonton."
    >
      <RequestList
        requests={requests.map((request) => ({
          ...request,
          requestedAt: request.requestedAt.toISOString(),
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
