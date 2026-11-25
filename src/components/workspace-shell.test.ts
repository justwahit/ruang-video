import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkspaceShell } from './workspace-shell'

describe('WorkspaceShell', () => {
  it('shows admin navigation and marks the active page', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceShell, {
        role: 'admin',
        userName: 'Ayu',
        activePath: '/admin/requests',
        eyebrow: 'Persetujuan',
        title: 'Permintaan akses',
        description: 'Tinjau permintaan.',
      },
      createElement('p', null, 'Konten')),
    )

    expect(markup).toContain('href="/admin/customers"')
    expect(markup).toContain('href="/admin/videos"')
    expect(markup).toContain('href="/admin/requests" aria-current="page"')
    expect(markup).not.toContain('href="/requests"')
    expect(markup).toContain('action="/api/auth/logout"')
  })

  it('shows customer navigation without admin links', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceShell, {
        role: 'customer',
        userName: 'Budi',
        activePath: '/videos',
        eyebrow: 'Katalog',
        title: 'Video untuk Anda',
        description: 'Pilih video.',
      },
      createElement('p', null, 'Konten')),
    )

    expect(markup).toContain('href="/videos" aria-current="page"')
    expect(markup).toContain('href="/requests"')
    expect(markup).not.toContain('href="/admin')
  })
})
