import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(readonly status: 401 | 403) {
      super(status === 401 ? 'Authentication required' : 'Insufficient permissions')
      this.name = 'AuthorizationError'
    }
  },
  requireRole: vi.fn(),
}))

import { requireRole } from '@/lib/auth'

const routePath = resolve(process.cwd(), 'src/app/api/videos/[videoId]/stream/route.ts')
const usernamePrefix = `stream-test-${Date.now()}-`
const videoBytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
let prisma: typeof import('@/lib/db').prisma | undefined
let storageDir = ''
let adminId = ''
let customerId = ''
let videoId = ''
let storageKey = ''

describe('protected video stream', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'file:./dev.db'
    storageDir = await mkdtemp(join(tmpdir(), 'video-stream-test-'))
    process.env.VIDEO_UPLOAD_DIR = storageDir
    prisma = (await import('@/lib/db')).prisma
    await prisma.$connect()
  })

  beforeEach(async () => {
    if (!prisma) return
    const admin = await prisma.user.create({
      data: {
        name: 'Stream Admin',
        username: `${usernamePrefix}admin-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'admin',
      },
    })
    const customer = await prisma.user.create({
      data: {
        name: 'Stream Customer',
        username: `${usernamePrefix}customer-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    storageKey = `${randomUUID()}.mp4`
    await writeFile(join(storageDir, storageKey), videoBytes)
    const video = await prisma.video.create({
      data: {
        title: `${usernamePrefix}video`,
        description: '',
        storageKey,
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: videoBytes.length,
      },
    })
    adminId = admin.id
    customerId = customer.id
    videoId = video.id
  })

  afterEach(async () => {
    if (!prisma) return
    await prisma.video.deleteMany({ where: { title: { startsWith: usernamePrefix } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: usernamePrefix } } })
    vi.mocked(requireRole).mockReset()
  })

  afterAll(async () => {
    await prisma?.$disconnect()
    if (storageDir) await rm(storageDir, { recursive: true, force: true })
  })

  async function getStream(range?: string) {
    const { GET } = await import('./route')
    return GET(
      new Request(`http://localhost/api/videos/${videoId}/stream`, {
        headers: range ? { Range: range } : undefined,
      }),
      { params: Promise.resolve({ videoId }) },
    )
  }

  async function grantAccess(expiresAt: Date, forCustomerId = customerId) {
    const request = await prisma!.accessRequest.create({
      data: {
        customerId: forCustomerId,
        videoId,
        status: 'approved',
        decidedById: adminId,
      },
    })
    await prisma!.videoGrant.create({
      data: {
        requestId: request.id,
        customerId: forCustomerId,
        videoId,
        approvedById: adminId,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt,
      },
    })
  }

  it('rejects unauthenticated requests', async () => {
    expect(existsSync(routePath)).toBe(true)
    vi.mocked(requireRole).mockRejectedValue(new (await import('@/lib/auth')).AuthorizationError(401))

    const response = await getStream()

    expect(response.status).toBe(401)
  })

  it('denies a customer without a grant', async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(403)
  })

  it('does not allow a customer to use another customer’s grant', async () => {
    const otherCustomer = await prisma!.user.create({
      data: {
        name: 'Other Stream Customer',
        username: `${usernamePrefix}other`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    await grantAccess(new Date(Date.now() + 60_000), otherCustomer.id)
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(403)
  })

  it('denies an expired grant', async () => {
    await grantAccess(new Date(Date.now() - 1))
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(403)
  })

  it('streams the complete file to a customer with an active grant', async () => {
    await grantAccess(new Date(Date.now() + 60_000))
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Length')).toBe(String(videoBytes.length))
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(videoBytes)
  })

  it('supports byte-range requests for browser seeking', async () => {
    await grantAccess(new Date(Date.now() + 60_000))
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream('bytes=2-4')

    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe(`bytes 2-4/${videoBytes.length}`)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(videoBytes.slice(2, 5))
  })

  it.each(['bytes=99-100', 'bytes=1-2,4-5'])(
    'returns 416 for malformed or unsatisfiable range %s',
    async (range) => {
      await grantAccess(new Date(Date.now() + 60_000))
      vi.mocked(requireRole).mockResolvedValue({
        id: customerId,
        name: 'Stream Customer',
        username: `${usernamePrefix}customer`,
        role: 'customer',
      })

      const response = await getStream(range)

      expect(response.status).toBe(416)
      expect(response.headers.get('Content-Range')).toBe(`bytes */${videoBytes.length}`)
    },
  )

  it('returns 404 when the stored file is missing', async () => {
    await grantAccess(new Date(Date.now() + 60_000))
    await rm(join(storageDir, storageKey))
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(404)
  })

  it('returns 404 for a deleted video', async () => {
    await grantAccess(new Date(Date.now() + 60_000))
    await prisma!.video.delete({ where: { id: videoId } })
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Stream Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const response = await getStream()

    expect(response.status).toBe(404)
  })
})
