import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-story">
          <div className="login-story-brand">
            <span className="login-brand-mark" aria-hidden="true">R</span>
            <span>Ruang Video</span>
          </div>
          <div className="login-story-copy">
            <p className="login-story-eyebrow">Akses terkontrol</p>
            <h2 className="login-story-title">
              Konten video, hanya untuk yang diizinkan.
            </h2>
            <p className="login-story-description">
              Masuk untuk mengelola atau menonton video sesuai masa akses Anda.
            </p>
          </div>
          <p className="login-story-note">Platform perizinan video</p>
        </div>
        <div className="login-panel">
          <div className="login-mobile-brand">
            <span className="login-brand-mark" aria-hidden="true">R</span>
            <span>Ruang Video</span>
          </div>
          <div>
            <p className="login-mobile-eyebrow">Area anggota</p>
            <h1 className="login-title">Selamat datang.</h1>
            <p className="login-description">Masuk dengan akun yang diberikan admin.</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
