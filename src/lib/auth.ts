import { errors, jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { roleSchema } from '@/lib/validation/auth'

export const SESSION_COOKIE_NAME = 'video_access_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

export type SessionUser = {
  id: string
  name: string
  username: string
  role: 'admin' | 'customer'
}

export type AuthUserRecord = Omit<SessionUser, 'role'> & {
  role: string
  passwordHash: string
}

type SessionUserRecord = Omit<AuthUserRecord, 'passwordHash'>
type UserLookup = (userId: string) => Promise<SessionUserRecord | null>

export class AuthorizationError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? 'Authentication required' : 'Insufficient permissions')
    this.name = 'AuthorizationError'
  }
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.')
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret())
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch (error) {
    if (error instanceof errors.JOSEError) return null
    throw error
  }
}

function toSessionUser(user: SessionUserRecord | null): SessionUser | null {
  if (!user) return null
  const role = roleSchema.safeParse(user.role)
  if (!role.success) return null

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: role.data,
  }
}

export async function verifyCredentials(
  user: AuthUserRecord | null,
  password: string,
): Promise<SessionUser | null> {
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null
  return toSessionUser(user)
}

export async function resolveSessionUser(
  token: string | undefined,
  findUserById: UserLookup,
): Promise<SessionUser | null> {
  const userId = await verifySessionToken(token)
  if (!userId) return null
  return toSessionUser(await findUserById(userId))
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return resolveSessionUser(token, (id) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, username: true, role: true },
    }),
  )
}

export function assertRole(
  user: SessionUser | null,
  role: SessionUser['role'],
): SessionUser {
  if (!user) throw new AuthorizationError(401)
  if (user.role !== role) throw new AuthorizationError(403)
  return user
}

export async function requireRole(
  role: SessionUser['role'],
): Promise<SessionUser> {
  return assertRole(await getCurrentUser(), role)
}
