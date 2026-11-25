import { redirect } from 'next/navigation'
import { CustomerManager } from '@/components/admin/customer-form'
import { WorkspaceShell } from '@/components/workspace-shell'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export default async function CustomersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/videos')

  const customers = await prisma.user.findMany({
    where: { role: 'customer' },
    select: { id: true, name: true, username: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <WorkspaceShell
      role="admin"
      userName={user.name}
      activePath="/admin/customers"
      eyebrow="Manajemen akun"
      title="Customer"
      description="Buat dan kelola akun yang dapat meminta akses video."
    >
      <CustomerManager
        initialCustomers={customers.map((customer) => ({
          ...customer,
          createdAt: customer.createdAt.toISOString(),
        }))}
      />
    </WorkspaceShell>
  )
}
