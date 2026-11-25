'use client'

import { useState } from 'react'

export function LoginForm() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setPending(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? 'Login gagal. Silakan coba lagi.')
        return
      }

      window.location.assign(result.user.role === 'admin' ? '/admin' : '/videos')
    } catch {
      setError('Tidak dapat menghubungi server. Periksa koneksi Anda.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      action={submit}
      className="login-form space-y-5"
      aria-describedby={error ? 'login-error' : undefined}
    >
      <div className="login-field">
        <label htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
        />
      </div>
      <div className="login-field">
        <label htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="login-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="login-submit"
      >
        {pending ? 'Memeriksa...' : 'Masuk'}
      </button>
    </form>
  )
}
