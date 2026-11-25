import { NextResponse } from 'next/server'
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyCredentials,
} from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validation/auth'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Permintaan login tidak valid.' }, { status: 400 })
    }
    throw error
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Username dan password wajib diisi.' }, { status: 400 })
  }

  const account = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: {
      id: true,
      name: true,
      username: true,
      passwordHash: true,
      role: true,
    },
  })
  const user = await verifyCredentials(account, parsed.data.password)
  if (!user) {
    return Response.json({ error: 'Username atau password salah.' }, { status: 401 })
  }

  const token = await createSessionToken(user.id)
  const response = NextResponse.json({ user })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}
