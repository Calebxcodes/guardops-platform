import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'strondis_guard_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  const essentialOnly = () => {
    localStorage.setItem(STORAGE_KEY, 'essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="bg-surface-card border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Cookie size={20} className="text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm mb-1">Cookies & Privacy</h3>
            <p className="text-white/40 text-xs leading-relaxed">
              We use <strong className="text-white/70">essential cookies</strong> to keep you signed in securely — these cannot be disabled. We also use analytics to improve the app. Accept all or continue with essentials only.
            </p>
          </div>
          <button onClick={essentialOnly} className="text-white/20 hover:text-white/50 shrink-0 p-0.5">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={accept}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={essentialOnly}
            className="flex-1 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
          >
            Essential Only
          </button>
        </div>
      </div>
    </div>
  )
}
