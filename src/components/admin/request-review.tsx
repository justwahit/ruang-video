'use client'

import { useState } from 'react'

export type AdminRequestItem = {
  id: string
  status: string
  requestedAt: string
  decidedAt: string | null
  adminNote: string | null
  customer: { id: string; name: string; username: string }
  video: { id: string; title: string }
  grant: { startsAt: string; expiresAt: string } | null
}

const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function RequestReview({ initialRequests }: { initialRequests: AdminRequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [durations, setDurations] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function decide(
    requestId: string,
    decision: { status: 'approved'; durationHours: number } | { status: 'rejected' },
  ) {
    setBusyId(requestId)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? { ...request, ...result.request } : request,
        ),
      )
      setMessage(
        decision.status === 'approved'
          ? 'Akses video berhasil disetujui.'
          : 'Permintaan akses berhasil ditolak.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Permintaan tidak dapat diproses.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {message && <p role="status" className="rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-800">{message}</p>}
      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
          Belum ada permintaan akses dari customer.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{request.video.title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      request.status === 'pending'
                        ? 'bg-amber-50 text-amber-800'
                        : request.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                    }`}>{statusLabels[request.status] ?? request.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{request.customer.name} <span className="text-slate-400">@{request.customer.username}</span></p>
                  <p className="mt-1 text-xs text-slate-500">Diajukan {formatDate(request.requestedAt)}</p>
                  {request.grant && (
                    <p className="mt-2 text-sm text-slate-600">Izin: {formatDate(request.grant.startsAt)} – {formatDate(request.grant.expiresAt)}</p>
                  )}
                  {request.adminNote && <p className="mt-2 text-sm text-slate-500">Catatan: {request.adminNote}</p>}
                </div>
                {request.status === 'pending' && (
                  <div className="flex shrink-0 flex-col gap-2 sm:w-52">
                    <label className="text-xs font-medium text-slate-600">
                      Durasi akses (jam)
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={durations[request.id] ?? '24'}
                        onChange={(event) =>
                          setDurations((current) => ({ ...current, [request.id]: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      disabled={busyId === request.id}
                      onClick={() => decide(request.id, {
                        status: 'approved',
                        durationHours: Number(durations[request.id] ?? 24),
                      })}
                      className="rounded-lg bg-pine-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pine-700 disabled:opacity-50"
                    >
                      Setujui akses
                    </button>
                    <button
                      disabled={busyId === request.id}
                      onClick={() => decide(request.id, { status: 'rejected' })}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
