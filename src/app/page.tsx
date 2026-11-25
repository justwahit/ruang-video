import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function Home() {
  return (
    <Suspense fallback={<main className="p-8 text-slate-500">Memuat akun...</main>}>
      <RouteLanding />
    </Suspense>
  )
}

async function RouteLanding() {
  const user = await getCurrentUser()
  if (!user) return redirect('/login')
  return redirect(user.role === 'admin' ? '/admin' : '/videos')
}
