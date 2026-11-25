'use client'

import { useEffect, useState } from 'react'

export type CatalogVideo = {
  id: string
  title: string
  description: string
  createdAt: string
  pendingRequest: boolean
  grantExpiresAt: string | null
}

function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function VideoCatalog({ initialVideos }: { initialVideos: CatalogVideo[] }) {
  const [videos, setVideos] = useState(initialVideos)
  const [message, setMessage] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const nextExpiry = videos
      .map((video) => video.grantExpiresAt ? new Date(video.grantExpiresAt).getTime() : Infinity)
      .filter((expiry) => expiry > now)
      .sort((left, right) => left - right)[0]
    if (nextExpiry === undefined) return

    const timeout = window.setTimeout(() => setNow(Date.now()), nextExpiry - now)
    return () => window.clearTimeout(timeout)
  }, [videos, now])

  async function requestAccess(videoId: string) {
    setPendingId(videoId)
    setMessage('')
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setVideos((current) =>
        current.map((video) =>
          video.id === videoId ? { ...video, pendingRequest: true } : video,
        ),
      )
      setMessage('Permintaan akses berhasil dikirim ke admin.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Permintaan tidak dapat dikirim.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {message && <p role="status" className="rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-800">{message}</p>}
      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
          Belum ada video yang tersedia.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => {
            const active = Boolean(video.grantExpiresAt && new Date(video.grantExpiresAt).getTime() > now)
            return (
              <article key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {active ? (
                  <video
                    controls
                    preload="none"
                    src={`/api/videos/${encodeURIComponent(video.id)}/stream`}
                    aria-label={`Tonton ${video.title}`}
                    className="aspect-video w-full bg-slate-950"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center bg-slate-950 text-pine-300">
                    <span className="grid size-14 place-items-center rounded-full border border-white/20 bg-white/10 text-2xl">▶</span>
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-semibold text-slate-950">{video.title}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{video.description || 'Tidak ada deskripsi.'}</p>
                  <div className="mt-5">
                    {active ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          Izin aktif · sampai {formatExpiry(video.grantExpiresAt!)}
                        </span>
                      </div>
                    ) : video.pendingRequest ? (
                      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                        Permintaan menunggu konfirmasi admin
                      </div>
                    ) : (
                      <button
                        disabled={pendingId === video.id}
                        onClick={() => requestAccess(video.id)}
                        className="w-full rounded-lg border border-pine-200 px-4 py-2.5 text-sm font-semibold text-pine-700 hover:bg-pine-50 disabled:opacity-50"
                      >
                        {pendingId === video.id ? 'Mengirim...' : 'Minta akses menonton'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
