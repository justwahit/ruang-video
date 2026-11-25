'use client'

import { useState } from 'react'

export type VideoListItem = {
  id: string
  title: string
  description: string
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function VideoManager({ initialVideos }: { initialVideos: VideoListItem[] }) {
  const [videos, setVideos] = useState(initialVideos)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function createVideo(formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/videos', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setVideos((current) => [result.video, ...current])
      setMessage('Video berhasil diunggah.')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video tidak dapat diunggah.')
      return false
    } finally {
      setPending(false)
    }
  }

  async function updateVideo(videoId: string, formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'PUT',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setVideos((current) =>
        current.map((video) => (video.id === videoId ? result.video : video)),
      )
      setEditingId(null)
      setMessage('Data video berhasil diperbarui.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video tidak dapat diperbarui.')
    } finally {
      setPending(false)
    }
  }

  async function deleteVideo(videoId: string) {
    if (!window.confirm('Hapus video ini beserta semua permintaan dan izinnya?')) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setVideos((current) => current.filter((video) => video.id !== videoId))
      setMessage('Video berhasil dihapus.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video tidak dapat dihapus.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <form
        action={async (formData) => {
          if (await createVideo(formData)) {
            (document.getElementById('video-create-form') as HTMLFormElement)?.reset()
          }
        }}
        id="video-create-form"
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <label className="text-sm font-medium text-slate-700">
          Judul video
          <input name="title" required minLength={2} maxLength={120} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          File video
          <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 font-normal file:mr-3 file:border-0 file:bg-transparent file:font-medium file:text-pine-700" />
          <span className="mt-1 block text-xs text-slate-500">MP4, WebM, atau MOV · maksimal 500 MB</span>
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Deskripsi
          <textarea name="description" rows={3} maxLength={2000} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
        </label>
        <button disabled={pending} className="w-fit rounded-lg bg-pine-600 px-4 py-2.5 font-semibold text-white hover:bg-pine-700 disabled:opacity-50">
          {pending ? 'Mengunggah...' : 'Unggah video'}
        </button>
      </form>

      {message && <p role="status" className="rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-800">{message}</p>}

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          Belum ada video. Unggah file video pertama untuk memulai.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {videos.map((video) => (
            <article key={video.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {editingId === video.id ? (
                <form action={(formData) => updateVideo(video.id, formData)} className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700">Judul
                    <input name="title" defaultValue={video.title} required minLength={2} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Deskripsi
                    <textarea name="description" defaultValue={video.description} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Ganti file (opsional)
                    <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 font-normal" />
                  </label>
                  <div className="flex gap-2">
                    <button disabled={pending} className="rounded-lg bg-pine-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Batal</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-slate-950">{video.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{video.description || 'Tanpa deskripsi.'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-pine-50 px-3 py-1 text-xs font-semibold text-pine-700">{formatBytes(video.sizeBytes)}</span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="min-w-0 truncate text-xs text-slate-500">{video.originalName} · {video.mimeType}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(video.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button disabled={pending} onClick={() => deleteVideo(video.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Hapus</button>
                    </div>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
