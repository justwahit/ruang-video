import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RequestList } from './request-list'

describe('RequestList', () => {
  it('links active access back to the protected video catalog', () => {
    const startsAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
    const markup = renderToStaticMarkup(
      createElement(RequestList, {
        requests: [{
          id: 'request-1',
          status: 'approved',
          requestedAt: startsAt,
          adminNote: null,
          video: { id: 'video-1', title: 'Video privat', description: '' },
          grant: { startsAt, expiresAt },
        }],
      }),
    )

    expect(markup).toContain('href="/videos"')
    expect(markup).not.toContain('href="/videos/video-1"')
  })
})
