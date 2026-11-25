'use client'

import { useState } from 'react'

export type CustomerListItem = {
  id: string
  name: string
  username: string
  createdAt: string
}

export function CustomerManager({ initialCustomers }: { initialCustomers: CustomerListItem[] }) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function submitNewCustomer(formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData)),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setCustomers((current) => [result.customer, ...current])
      setMessage('Data customer berhasil ditambahkan.')
      return { reset: true }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Customer tidak dapat ditambahkan.')
      return { reset: false }
    } finally {
      setPending(false)
    }
  }

  async function updateCustomer(customerId: string, formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const values = Object.fromEntries(formData)
      if (!values.password) delete values.password
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId ? { ...customer, ...result.customer } : customer,
        ),
      )
      setEditingId(null)
      setMessage('Data customer berhasil diperbarui.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Customer tidak dapat diperbarui.')
    } finally {
      setPending(false)
    }
  }

  async function deleteCustomer(customerId: string) {
    if (!window.confirm('Hapus customer ini beserta semua permintaan dan izinnya?')) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setCustomers((current) => current.filter((customer) => customer.id !== customerId))
      setMessage('Customer berhasil dihapus.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Customer tidak dapat dihapus.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <form
        action={async (formData) => {
          const result = await submitNewCustomer(formData)
          if (result.reset) (document.getElementById('customer-create-form') as HTMLFormElement)?.reset()
        }}
        id="customer-create-form"
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
      >
        <label className="text-sm font-medium text-slate-700">
          Nama lengkap
          <input name="name" required minLength={2} maxLength={100} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Username
          <input name="username" required minLength={3} maxLength={64} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Password awal
          <input name="password" type="password" required minLength={10} maxLength={128} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
        </label>
        <button disabled={pending} className="self-end rounded-lg bg-pine-600 px-4 py-2.5 font-semibold text-white hover:bg-pine-700 disabled:opacity-50">
          Tambah customer
        </button>
      </form>

      {message && <p role="status" className="rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-800">{message}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Daftar customer <span className="ml-1 text-slate-400">{customers.length}</span></h2>
        </div>
        {customers.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Belum ada customer. Tambahkan akun pertama di atas.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <div key={customer.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                {editingId === customer.id ? (
                  <form
                    action={(formData) => updateCustomer(customer.id, formData)}
                    className="grid flex-1 gap-3 md:grid-cols-3"
                  >
                    <input name="name" defaultValue={customer.name} required minLength={2} className="rounded-lg border border-slate-200 px-3 py-2" aria-label="Nama customer" />
                    <input name="username" defaultValue={customer.username} required minLength={3} className="rounded-lg border border-slate-200 px-3 py-2" aria-label="Username customer" />
                    <input name="password" type="password" minLength={10} placeholder="Password baru (opsional)" className="rounded-lg border border-slate-200 px-3 py-2" aria-label="Password baru" />
                    <div className="flex gap-2 md:col-span-3">
                      <button disabled={pending} className="rounded-lg bg-pine-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Batal</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{customer.name}</p>
                      <p className="mt-1 wrap-anywhere text-sm text-slate-500">@{customer.username}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => setEditingId(customer.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button disabled={pending} onClick={() => deleteCustomer(customer.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Hapus</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
