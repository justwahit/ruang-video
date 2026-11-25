import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

const accessModulePath = resolve(process.cwd(), 'src/lib/access/requests.ts')
const usernamePrefix = `access-test-${Date.now()}-`

let prisma: typeof import('@/lib/db').prisma | undefined
let adminId = ''
let customerId = ''
let videoId = ''

describe('time-limited video access', () => {
  beforeAll(async () => {
    if (!existsSync(accessModulePath)) return
    process.env.DATABASE_URL ??= 'file:./dev.db'
    prisma = (await import('@/lib/db')).prisma
    await prisma.$connect()
  })

  beforeEach(async () => {
    if (!prisma) return
    const admin = await prisma.user.create({
      data: {
        name: 'Access Admin',
        username: `${usernamePrefix}admin-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'admin',
      },
    })
    const customer = await prisma.user.create({
      data: {
        name: 'Access Customer',
        username: `${usernamePrefix}customer-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    const video = await prisma.video.create({
      data: {
        title: `${usernamePrefix}video`,
        description: '',
        storageKey: `${Date.now()}-${Math.random()}-access.mp4`,
        originalName: 'access.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 4,
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
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('prevents a second pending request for the same customer and video', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest } = await import('./requests')
    await createAccessRequest(customerId, videoId)
    await expect(createAccessRequest(customerId, videoId)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('creates at most one pending request when simultaneous requests race', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest } = await import('./requests')
    const results = await Promise.allSettled([
      createAccessRequest(customerId, videoId),
      createAccessRequest(customerId, videoId),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(
      await prisma!.accessRequest.count({
        where: { customerId, videoId, status: 'pending' },
      }),
    ).toBe(1)
  })

  it('prevents a request while the customer has an active grant', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest } = await import('./requests')
    const request = await prisma!.accessRequest.create({
      data: { customerId, videoId, status: 'approved' },
    })
    await prisma!.videoGrant.create({
      data: {
        requestId: request.id,
        customerId,
        videoId,
        approvedById: adminId,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await expect(createAccessRequest(customerId, videoId)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('allows a new request after the previous grant has expired', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest } = await import('./requests')
    const previous = await prisma!.accessRequest.create({
      data: { customerId, videoId, status: 'approved' },
    })
    await prisma!.videoGrant.create({
      data: {
        requestId: previous.id,
        customerId,
        videoId,
        approvedById: adminId,
        startsAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      },
    })

    expect((await createAccessRequest(customerId, videoId)).status).toBe('pending')
  })

  it('rejects non-positive or fractional approval durations', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest, decideAccessRequest } = await import('./requests')
    const request = await createAccessRequest(customerId, videoId)

    await expect(
      decideAccessRequest(request.id, adminId, { status: 'approved', durationHours: 0 }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      decideAccessRequest(request.id, adminId, { status: 'approved', durationHours: 1.5 }),
    ).rejects.toMatchObject({ status: 400 })
    expect((await prisma!.accessRequest.findUniqueOrThrow({ where: { id: request.id } })).status)
      .toBe('pending')
  })

  it('approves a pending request and creates a grant for the requested hours', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest, decideAccessRequest } = await import('./requests')
    const request = await createAccessRequest(customerId, videoId)
    const approved = await decideAccessRequest(request.id, adminId, {
      status: 'approved',
      durationHours: 2,
    })

    expect(approved.status).toBe('approved')
    expect(approved.grant).toMatchObject({
      customerId,
      videoId,
      approvedById: adminId,
    })
    expect(approved.grant!.expiresAt.getTime() - approved.grant!.startsAt.getTime())
      .toBe(2 * 60 * 60 * 1000)
  })

  it('rejects a request without creating a grant and allows only one decision', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { createAccessRequest, decideAccessRequest } = await import('./requests')
    const request = await createAccessRequest(customerId, videoId)
    const rejected = await decideAccessRequest(request.id, adminId, {
      status: 'rejected',
      note: 'Permintaan ditolak.',
    })

    expect(rejected.status).toBe('rejected')
    expect(rejected.grant).toBeNull()
    await expect(
      decideAccessRequest(request.id, adminId, { status: 'approved', durationHours: 1 }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('treats a grant as active at startsAt but inactive at expiresAt', async () => {
    expect(existsSync(accessModulePath)).toBe(true)
    if (!existsSync(accessModulePath)) return

    const { hasActiveGrant } = await import('./requests')
    const startsAt = new Date(Date.now() - 10_000)
    const expiresAt = new Date(Date.now() + 10_000)
    const request = await prisma!.accessRequest.create({
      data: { customerId, videoId, status: 'approved' },
    })
    await prisma!.videoGrant.create({
      data: { requestId: request.id, customerId, videoId, approvedById: adminId, startsAt, expiresAt },
    })

    expect(await hasActiveGrant(customerId, videoId, startsAt)).toBe(true)
    expect(await hasActiveGrant(customerId, videoId, new Date(expiresAt.getTime() - 1))).toBe(true)
    expect(await hasActiveGrant(customerId, videoId, expiresAt)).toBe(false)
  })
})
