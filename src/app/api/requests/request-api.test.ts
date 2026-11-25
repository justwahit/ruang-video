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
  vi,
} from 'vitest'

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

const routePath = resolve(process.cwd(), 'src/app/api/requests/route.ts')
const adminDecisionRoutePath = resolve(
  process.cwd(),
  'src/app/api/admin/requests/[requestId]/route.ts',
)
const usernamePrefix = `request-api-${Date.now()}-`
let prisma: typeof import('@/lib/db').prisma | undefined
let adminId = ''
let customerId = ''
let videoId = ''

describe('access request API identity boundaries', () => {
  beforeAll(async () => {
    if (!existsSync(routePath)) return
    process.env.DATABASE_URL ??= 'file:./dev.db'
    prisma = (await import('@/lib/db')).prisma
    await prisma.$connect()
  })

  beforeEach(async () => {
    if (!prisma) return
    const admin = await prisma.user.create({
      data: {
        name: 'Request Admin',
        username: `${usernamePrefix}admin-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'admin',
      },
    })
    const customer = await prisma.user.create({
      data: {
        name: 'Request Customer',
        username: `${usernamePrefix}customer-${Math.random()}`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    const video = await prisma.video.create({
      data: {
        title: `${usernamePrefix}video`,
        description: '',
        storageKey: `${Date.now()}-${Math.random()}-request-api.mp4`,
        originalName: 'request-api.mp4',
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
    vi.mocked(requireRole).mockReset()
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it('creates requests for the signed-in customer, ignoring a forged customerId', async () => {
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Request Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })
    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, customerId: adminId }),
      }),
    )
    const result = await response.json()

    expect(response.status).toBe(201)
    expect(
      (await prisma!.accessRequest.findUniqueOrThrow({ where: { id: result.request.id } }))
        .customerId,
    ).toBe(customerId)
  })

  it('lists only the signed-in customer’s requests', async () => {
    expect(existsSync(routePath)).toBe(true)
    if (!existsSync(routePath)) return

    const otherCustomer = await prisma!.user.create({
      data: {
        name: 'Other Customer',
        username: `${usernamePrefix}other`,
        passwordHash: 'irrelevant-test-hash',
        role: 'customer',
      },
    })
    await prisma!.accessRequest.create({
      data: { customerId, videoId, status: 'pending', pendingKey: `${customerId}:${videoId}` },
    })
    const otherVideo = await prisma!.video.create({
      data: {
        title: `${usernamePrefix}other-video`,
        description: '',
        storageKey: `${Date.now()}-${Math.random()}-other.mp4`,
        originalName: 'other.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 4,
      },
    })
    await prisma!.accessRequest.create({
      data: { customerId: otherCustomer.id, videoId: otherVideo.id, status: 'pending' },
    })
    vi.mocked(requireRole).mockResolvedValue({
      id: customerId,
      name: 'Request Customer',
      username: `${usernamePrefix}customer`,
      role: 'customer',
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/requests'))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].customerId).toBe(customerId)
  })

  it('records the approving admin from the session, not the request body', async () => {
    expect(existsSync(adminDecisionRoutePath)).toBe(true)
    if (!existsSync(adminDecisionRoutePath)) return

    const accessRequest = await prisma!.accessRequest.create({
      data: { customerId, videoId, status: 'pending', pendingKey: `${customerId}:${videoId}` },
    })
    vi.mocked(requireRole).mockResolvedValue({
      id: adminId,
      name: 'Request Admin',
      username: `${usernamePrefix}admin`,
      role: 'admin',
    })
    const { POST } = await import('../admin/requests/[requestId]/route')
    const response = await POST(
      new Request(`http://localhost/api/admin/requests/${accessRequest.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          durationHours: 1,
          adminId: customerId,
        }),
      }),
      { params: Promise.resolve({ requestId: accessRequest.id }) },
    )
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.request.grant.approvedById).toBe(adminId)
  })
})
