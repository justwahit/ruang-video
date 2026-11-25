import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/workspace-shell'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const sections = [
  {
    href: '/admin/customers',
    title: 'Kelola customer',
    description: 'Buat akun dan perbarui data customer.',
    countKey: 'customers',
  },
  {
    href: '/admin/videos',
    title: 'Kelola video',
    description: 'Unggah, ubah, atau hapus video.',
    countKey: 'videos',
  },
  {
    href: '/admin/requests',
    title: 'Permintaan akses',
    description: 'Tinjau dan tentukan masa izin menonton.',
    countKey: 'requests',
  },
] as const

export default async function AdminDashboard() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/videos')

  const [customers, videos, requests] = await Promise.all([
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.video.count(),
    prisma.accessRequest.count({ where: { status: 'pending' } }),
  ])
  const counts = { customers, videos, requests }

  return (
    <WorkspaceShell
      role="admin"
      userName={user.name}
      activePath="/admin"
      eyebrow="Ruang Video · Operasional"
      title="Dashboard admin"
      description={`Selamat datang, ${user.name}. Kelola customer, video, dan izin menonton.`}
    >
      <section aria-label="Ringkasan" className="mb-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Customer" value={customers} />
          <SummaryCard label="Video" value={videos} />
          <SummaryCard label="Permintaan menunggu" value={requests} />
      </section>

      <section aria-label="Menu admin" className="grid gap-5 md:grid-cols-3">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-pine-200 hover:shadow-md"
          >
            <span className="text-sm font-semibold text-pine-600">{counts[section.countKey]}</span>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
            <span className="mt-5 inline-block text-sm font-semibold text-pine-700">Buka halaman →</span>
          </a>
        ))}
      </section>
    </WorkspaceShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  )
}
