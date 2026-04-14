import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'strondis_ops_cookie_consent'

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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Cookie size={20} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm mb-1">Cookies & Privacy</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              We use <strong className="text-gray-300">essential cookies</strong> to keep you signed in and run the platform securely — these cannot be disabled. We also use analytics cookies to improve your experience. You can accept all cookies or continue with essential cookies only.
            </p>
          </div>
          <button onClick={essentialOnly} className="text-gray-600 hover:text-gray-400 shrink-0 p-0.5">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={accept}
            className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={essentialOnly}
            className="flex-1 min-w-[120px] border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
          >
            Essential Only
          </button>
        </div>
      </div>
    </div>
  )
}
