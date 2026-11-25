import { redirect } from 'next/navigation'
import { VideoManager } from '@/components/admin/video-form'
import { WorkspaceShell } from '@/components/workspace-shell'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export default async function AdminVideosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/videos')

  const videos = await prisma.video.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <WorkspaceShell
      role="admin"
      userName={user.name}
      activePath="/admin/videos"
      eyebrow="Perpustakaan"
      title="Video"
      description="Unggah file video dan atur informasi yang dapat dilihat customer."
    >
      <VideoManager
        initialVideos={videos.map((video) => ({
          ...video,
          createdAt: video.createdAt.toISOString(),
        }))}
      />
    </WorkspaceShell>
  )
}
