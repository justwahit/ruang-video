import { describe, expect, it } from 'vitest'
import { POST } from './route'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

describe('logout route', () => {
  it('clears the session and redirects the browser to the login page', async () => {
    const response = await POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }))
    const cookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/login')
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(cookie).toContain('Max-Age=0')
  })
})
