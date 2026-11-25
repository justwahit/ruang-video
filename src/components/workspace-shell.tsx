import type { ReactNode } from 'react'

type WorkspaceRole = 'admin' | 'customer'

type WorkspaceShellProps = {
  role: WorkspaceRole
  userName: string
  activePath: string
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}

const navigationByRole: Record<WorkspaceRole, { href: string; label: string }[]> = {
  admin: [
    { href: '/admin', label: 'Ikhtisar' },
    { href: '/admin/customers', label: 'Customer' },
    { href: '/admin/videos', label: 'Video' },
    { href: '/admin/requests', label: 'Permintaan' },
  ],
  customer: [
    { href: '/videos', label: 'Katalog' },
    { href: '/requests', label: 'Permintaan saya' },
  ],
}

export function WorkspaceShell({
  role,
  userName,
  activePath,
  eyebrow,
  title,
  description,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <div className="workspace-identity-row">
            <a
              href={role === 'admin' ? '/admin' : '/videos'}
              className="workspace-brand"
              aria-label="Ruang Video, beranda"
            >
              <span className="workspace-brand-mark" aria-hidden="true">R</span>
              <span className="workspace-brand-copy">
                <span>Ruang Video</span>
                <small>Arsip tontonan privat</small>
              </span>
            </a>

            <div className="workspace-account">
              <span className="workspace-account-name">{userName}</span>
              <span className="workspace-account-role">
                {role === 'admin' ? 'Administrator' : 'Customer'}
              </span>
              <form action="/api/auth/logout" method="post">
                <button className="workspace-signout" type="submit">Keluar</button>
              </form>
            </div>
          </div>

          <nav aria-label="Navigasi utama" className="workspace-nav">
            {navigationByRole[role].map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={activePath === item.href ? 'page' : undefined}
                className="workspace-nav-link"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="workspace-content">
        <header className="workspace-page-heading">
          <div>
            <p className="workspace-eyebrow">{eyebrow}</p>
            <h1 className="workspace-title">{title}</h1>
            <p className="workspace-description">{description}</p>
          </div>
        </header>
        {children}
        <footer className="workspace-footer">
          <span>Ruang Video</span>
          <span>Akses sesuai izin, menonton dengan tenang.</span>
        </footer>
      </main>
    </div>
  )
}
