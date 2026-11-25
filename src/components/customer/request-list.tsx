export type CustomerRequest = {
  id: string
  status: string
  requestedAt: string
  adminNote: string | null
  video: { id: string; title: string; description: string }
  grant: { startsAt: string; expiresAt: string } | null
}

const statusLabel: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export function RequestList({ requests }: { requests: CustomerRequest[] }) {
  const now = new Date()

  return requests.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
      Belum ada permintaan akses. Jelajahi katalog video untuk mengajukan izin menonton.
    </div>
  ) : (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {requests.map((request) => {
          const active =
            request.grant !== null &&
            new Date(request.grant.startsAt) <= now &&
            now < new Date(request.grant.expiresAt)
          const status = active ? 'active' : request.status
          const label = status === 'active' ? 'Izin aktif' : statusLabel[status]
          const badgeColor =
            status === 'active'
              ? 'bg-emerald-50 text-emerald-700'
              : status === 'pending'
                ? 'bg-amber-50 text-amber-800'
                : status === 'approved'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-rose-50 text-rose-700'

          return (
            <article key={request.id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">{request.video.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Diajukan {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.requestedAt))}
                </p>
                {request.grant && (
                  <p className="mt-2 text-sm text-slate-500">
                    Akses: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.grant.startsAt))}
                    {' – '}
                    {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.grant.expiresAt))}
                  </p>
                )}
                {request.adminNote && <p className="mt-2 text-sm text-slate-600">Catatan admin: {request.adminNote}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${badgeColor}`}>{label}</span>
                {status === 'active' && (
                  <a href="/videos" className="rounded-lg bg-pine-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pine-700">
                    Buka katalog
                  </a>
                )}
                {status === 'rejected' || status === 'approved' ? (
                  <a href="/videos" className="text-sm font-semibold text-pine-700 hover:text-pine-900">Minta lagi</a>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
