import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { compare, hash } from 'bcryptjs'
import { describe, expect, it } from 'vitest'

const authModulePath = resolve(process.cwd(), 'src/lib/auth.ts')
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes'

describe('authentication and authorization', () => {
  it('accepts a valid password and rejects an incorrect one', async () => {
    expect(existsSync(authModulePath)).toBe(true)
    if (!existsSync(authModulePath)) return

    const { verifyCredentials } = await import('./auth')
    const user = {
      id: 'admin-1',
      name: 'Admin',
      username: 'admin',
      passwordHash: await hash('correct-password', 4),
      role: 'admin',
    }

    expect(await verifyCredentials(user, 'correct-password')).toMatchObject({
      id: 'admin-1',
      role: 'admin',
    })
    expect(await verifyCredentials(user, 'incorrect-password')).toBeNull()
    expect(await verifyCredentials(null, 'correct-password')).toBeNull()
    expect(await compare('correct-password', user.passwordHash)).toBe(true)
  })

  it('rejects missing and tampered session tokens', async () => {
    expect(existsSync(authModulePath)).toBe(true)
    if (!existsSync(authModulePath)) return

    const { verifySessionToken } = await import('./auth')
    expect(await verifySessionToken(undefined)).toBeNull()
    expect(await verifySessionToken('not-a-valid-token')).toBeNull()
  })

  it('does not resolve a deleted account from a valid session', async () => {
    expect(existsSync(authModulePath)).toBe(true)
    if (!existsSync(authModulePath)) return

    const { createSessionToken, resolveSessionUser } = await import('./auth')
    const token = await createSessionToken('deleted-user')
    expect(await resolveSessionUser(token, async () => null)).toBeNull()
  })

  it('rejects customers from admin-only operations', async () => {
    expect(existsSync(authModulePath)).toBe(true)
    if (!existsSync(authModulePath)) return

    const { assertRole, AuthorizationError } = await import('./auth')
    const customer = {
      id: 'customer-1',
      name: 'Customer',
      username: 'customer',
      role: 'customer' as const,
    }

    expect(() => assertRole(customer, 'admin')).toThrow(AuthorizationError)
    expect(() => assertRole(customer, 'admin')).toThrowError(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('returns an unauthenticated error when no current user exists', async () => {
    expect(existsSync(authModulePath)).toBe(true)
    if (!existsSync(authModulePath)) return

    const { assertRole, AuthorizationError } = await import('./auth')
    try {
      assertRole(null, 'customer')
      throw new Error('assertRole unexpectedly accepted an empty user')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as InstanceType<typeof AuthorizationError>).status).toBe(401)
    }
  })
})
