import { useState, useEffect } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader, X, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { deleteSelf } from '../api/masterAdminApi'

type ModalState = 'idle' | 'loading' | 'error'

export default function Settings() {
  const { name, role, logout } = useAuthStore()

  // ── Danger zone modal state ───────────────────────────────────────────────
  const [open, setOpen]         = useState(false)
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [checked, setChecked]   = useState(false)
  const [modalState, setModalState] = useState<ModalState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function openModal() {
    setPassword(''); setShowPass(false); setChecked(false)
    setModalState('idle'); setErrorMsg('')
    setOpen(true)
  }

  function closeModal() {
    if (modalState === 'loading') return
    setOpen(false)
  }

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, modalState])

  const canSubmit = password.length > 0 && checked && modalState === 'idle'

  async function handleDelete() {
    if (!canSubmit) return
    setModalState('loading')
    setErrorMsg('')
    try {
      await deleteSelf(password)
      // Success — clear session then redirect
      logout()
      window.location.href = 'https://strondis.com'
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.'
      setErrorMsg(msg)
      setModalState('error')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your master admin account</p>

      {/* ── Account info ─────────────────────────────────────────────────── */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm text-white font-medium">{name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Role</span>
            <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded font-medium">
              {role ?? '—'}
            </span>
          </div>
        </div>
      </section>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <section className="border border-red-900/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-4 flex items-center gap-2">
          <ShieldAlert size={15} />
          Danger Zone
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Delete My Master Admin Account</p>
            <p className="text-xs text-gray-500 mt-0.5">
              This is permanent. You cannot undo this.
            </p>
          </div>
          <button
            onClick={openModal}
            className="shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <AlertTriangle size={15} />
            Delete My Account
          </button>
        </div>
      </section>

      {/* ── Confirmation modal ───────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-base font-semibold text-white">Delete Master Admin Account</h3>
              <button
                onClick={closeModal}
                disabled={modalState === 'loading'}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
              >
                <X size={17} />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Warning banner */}
              <div className="bg-red-950/60 border border-red-800/60 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300 leading-snug">
                    This action is permanent and cannot be undone
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-red-400/80">
                    <li>• Your login access will be revoked immediately</li>
                    <li>• Other master admins and all tenants are unaffected</li>
                    <li>• This account cannot be restored</li>
                  </ul>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Confirm your password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={modalState === 'loading'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white
                               placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500
                               disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => setChecked(e.target.checked)}
                  disabled={modalState === 'loading'}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 accent-red-600 cursor-pointer"
                />
                <span className="text-sm text-gray-400 leading-snug">I understand</span>
              </label>

              {/* Error — including the "last super_admin" guard */}
              {modalState === 'error' && errorMsg && (
                <div className="bg-red-950/50 border border-red-800/50 text-red-300 text-sm rounded-lg px-4 py-3">
                  {errorMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeModal}
                  disabled={modalState === 'loading'}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-medium transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!canSubmit}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-red-600 hover:bg-red-700
                             disabled:bg-red-900/40 disabled:text-red-700 disabled:cursor-not-allowed
                             text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {modalState === 'loading' ? (
                    <>
                      <Loader size={15} className="animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    'Delete My Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
