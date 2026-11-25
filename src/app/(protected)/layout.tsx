import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getCurrentUser } from '@/lib/auth'

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Memuat akun...</div>}>
      <RequireSession>{children}</RequireSession>
    </Suspense>
  )
}

async function RequireSession({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return children
}
