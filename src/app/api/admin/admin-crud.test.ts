import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm } from 'node:fs/promises'
import { compare } from 'bcryptjs'
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

const routePath = resolve(
  process.cwd(),
  'src/app/api/admin/customers/route.ts',
)
const videoRoutePath = resolve(process.cwd(), 'src/app/api/admin/videos/route.ts')
const usernamePrefix = `crud-test-${Date.now()}-`
const uploadDirectory = join(tmpdir(), `video-api-${Date.now()}`)
let adminId = ''
let admin = {
  id: '',
  name: 'Test Admin',
  username: '',
  role: 'admin' as const,
}

let prisma: typeof import('@/lib/db').prisma | undefined

describe('admin customer management API', () => {
  beforeAll(async () => {
    if (!existsSync(routePath)) return
    process.env.DATABASE_URL ??= 'file:./dev.db'
    process.env.VIDEO_UPLOAD_DIR = uploadDirectory
    prisma = (await import('@/lib/db')).prisma
    await prisma.$connect()
  })

  beforeEach(async () => {
    if (!prisma) return
    const account = await prisma.user.create({
      data: {
        name: admin.name,
        username: `${usernamePrefix}admin-${Date.now()}-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'admin',
      },
    })
    adminId = account.id
    admin = { ...admin, id: account.id, username: account.username }
  })

  afterEach(async () => {
    if (!prisma) return
    await prisma.video.deleteMany({
      where: { title: { startsWith: usernamePrefix } },
    })
    await prisma.user.deleteMany({
      where: { username: { startsWith: usernamePrefix } },
    })
    vi.mocked(requireRole).mockReset()
  })

  afterAll(async () => {
    await prisma?.$disconnect()
    await rm(uploadDirectory, { recursive: true, force: true })
  })

  it('rejects customer-list requests when the caller is not an admin', async () => {
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    vi.mocked(requireRole).mockRejectedValueOnce(
      new (await import('@/lib/auth')).AuthorizationError(403),
    )
    const { GET } = await import('./customers/route')
    const response = await GET(new Request('http://localhost/api/admin/customers'))

    expect(response.status).toBe(403)
  })

  it('creates customers with a hashed password and never returns the hash', async () => {
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    vi.mocked(requireRole).mockResolvedValue(admin)
    const { POST } = await import('./customers/route')
    const password = 'customer-password-123'
    const response = await POST(
      new Request('http://localhost/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Customer',
          username: `${usernamePrefix}one`,
          password,
        }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.customer.passwordHash).toBeUndefined()
    const stored = await prisma!.user.findUnique({
      where: { username: `${usernamePrefix}one` },
    })
    expect(stored?.role).toBe('customer')
    expect(stored?.passwordHash).not.toBe(password)
    expect(await compare(password, stored!.passwordHash)).toBe(true)
  })

  it('updates and deletes only customer accounts', async () => {
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    const customer = await prisma!.user.create({
      data: {
        name: 'Before',
        username: `${usernamePrefix}two`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    const video = await prisma!.video.create({
      data: {
        title: `${usernamePrefix}customer-delete`,
        description: '',
        storageKey: `${Date.now()}-customer-delete.mp4`,
        originalName: 'customer-delete.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 4,
      },
    })
    const request = await prisma!.accessRequest.create({
      data: { customerId: customer.id, videoId: video.id, status: 'approved' },
    })
    const grant = await prisma!.videoGrant.create({
      data: {
        requestId: request.id,
        customerId: customer.id,
        videoId: video.id,
        approvedById: adminId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    vi.mocked(requireRole).mockResolvedValue(admin)

    const { PUT, DELETE } = await import('./customers/[customerId]/route')
    const updateResponse = await PUT(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'After' }),
      }),
      { params: Promise.resolve({ customerId: customer.id }) },
    )
    expect(updateResponse.status).toBe(200)
    expect(
      (await prisma!.user.findUnique({ where: { id: customer.id } }))?.name,
    ).toBe('After')

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ customerId: customer.id }) },
    )
    expect(deleteResponse.status).toBe(200)
    expect(await prisma!.user.findUnique({ where: { id: customer.id } })).toBeNull()
    expect(await prisma!.accessRequest.findUnique({ where: { id: request.id } })).toBeNull()
    expect(await prisma!.videoGrant.findUnique({ where: { id: grant.id } })).toBeNull()
    expect(await prisma!.video.findUnique({ where: { id: video.id } })).not.toBeNull()
  })

  it('replaces an uploaded video file and removes the previous stored file', async () => {
    expect(existsSync(videoRoutePath)).toBe(true)
    if (!existsSync(videoRoutePath)) return

    vi.mocked(requireRole).mockResolvedValue(admin)
    const { POST } = await import('./videos/route')
    const createForm = new FormData()
    createForm.set('title', `${usernamePrefix}replace`)
    createForm.set('description', 'Before')
    createForm.set('video', new File([new Uint8Array([1, 2, 3])], 'before.mp4', { type: 'video/mp4' }))
    const createResponse = await POST(
      new Request('http://localhost/api/admin/videos', { method: 'POST', body: createForm }),
    )
    expect(createResponse.status).toBe(201)
    const { video: created } = await createResponse.json()
    const before = await prisma!.video.findUniqueOrThrow({ where: { id: created.id } })

    const updateForm = new FormData()
    updateForm.set('title', `${usernamePrefix}replace`)
    updateForm.set('description', 'After')
    updateForm.set('video', new File([new Uint8Array([9, 8, 7, 6])], 'after.webm', { type: 'video/webm' }))
    const { PUT } = await import('./videos/[videoId]/route')
    const updateResponse = await PUT(
      new Request(`http://localhost/api/admin/videos/${created.id}`, {
        method: 'PUT',
        body: updateForm,
      }),
      { params: Promise.resolve({ videoId: created.id }) },
    )
    expect(updateResponse.status).toBe(200)
    const after = await prisma!.video.findUniqueOrThrow({ where: { id: created.id } })

    expect(after.description).toBe('After')
    expect(after.storageKey).not.toBe(before.storageKey)
    expect(existsSync(join(uploadDirectory, before.storageKey))).toBe(false)
    expect(existsSync(join(uploadDirectory, after.storageKey))).toBe(true)
  })

  it('deletes a video file and cascades its requests and grants', async () => {
    expect(existsSync(videoRoutePath)).toBe(true)
    if (!existsSync(videoRoutePath)) return

    vi.mocked(requireRole).mockResolvedValue(admin)
    const { storeVideo } = await import('@/lib/storage/videos')
    const stored = await storeVideo(new File([new Uint8Array([1, 2])], 'cascade.mp4', { type: 'video/mp4' }))
    const video = await prisma!.video.create({
      data: { title: `${usernamePrefix}cascade`, description: '', ...stored },
    })
    const customer = await prisma!.user.create({
      data: {
        name: 'Cascade Customer',
        username: `${usernamePrefix}cascade-customer`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    const request = await prisma!.accessRequest.create({
      data: { customerId: customer.id, videoId: video.id, status: 'approved' },
    })
    const grant = await prisma!.videoGrant.create({
      data: {
        requestId: request.id,
        customerId: customer.id,
        videoId: video.id,
        approvedById: adminId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    const { DELETE } = await import('./videos/[videoId]/route')
    const response = await DELETE(
      new Request(`http://localhost/api/admin/videos/${video.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ videoId: video.id }) },
    )

    expect(response.status).toBe(200)
    expect(await prisma!.video.findUnique({ where: { id: video.id } })).toBeNull()
    expect(await prisma!.accessRequest.findUnique({ where: { id: request.id } })).toBeNull()
    expect(await prisma!.videoGrant.findUnique({ where: { id: grant.id } })).toBeNull()
    expect(existsSync(join(uploadDirectory, stored.storageKey))).toBe(false)
  })
})
