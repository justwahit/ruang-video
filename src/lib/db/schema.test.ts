import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compare } from 'bcryptjs'

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma')
const seedModulePath = resolve(process.cwd(), 'src/lib/db/admin-seed.ts')

describe('SQLite data model', () => {
  it('defines users, videos, requests, grants, and their required relations', () => {
    expect(existsSync(schemaPath)).toBe(true)
    if (!existsSync(schemaPath)) return

    const schema = readFileSync(schemaPath, 'utf8')
    for (const model of ['User', 'Video', 'AccessRequest', 'VideoGrant']) {
      expect(schema).toContain(`model ${model} {`)
    }

    expect(schema).toMatch(/username\s+String\s+@unique/)
    expect(schema).toMatch(/customerId\s+String/)
    expect(schema).toMatch(/videoId\s+String/)
    expect(schema).toMatch(/startsAt\s+DateTime/)
    expect(schema).toMatch(/expiresAt\s+DateTime/)
  })

  it('creates an admin seed with a verified password hash', async () => {
    expect(existsSync(seedModulePath)).toBe(true)
    if (!existsSync(seedModulePath)) return

    const { createAdminSeedData } = await import('./admin-seed')
    const data = await createAdminSeedData({
      username: 'ROOT-ADMIN',
      password: 'a-strong-password',
    })

    expect(data.role).toBe('admin')
    expect(data.username).toBe('root-admin')
    expect(data.passwordHash).not.toBe('a-strong-password')
    expect(await compare('a-strong-password', data.passwordHash)).toBe(true)
  })
})
