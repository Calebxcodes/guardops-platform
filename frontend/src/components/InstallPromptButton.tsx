import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPromptButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (installed) return null
  if (!deferredPrompt && !isIOS) return null

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  return (
    <>
      <button
        onClick={handleInstall}
        className={`flex items-center justify-center gap-2 w-full border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-medium rounded-xl py-3 transition-colors text-sm ${className}`}
      >
        <Download size={16} />
        Install App
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4" onClick={() => setShowIOSGuide(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-blue-400" />
                <h3 className="font-semibold text-white">Install on iPhone / iPad</h3>
              </div>
              <button onClick={() => setShowIOSGuide(false)} className="text-gray-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">1</span>
                Tap the <strong className="text-white mx-1">Share</strong> button at the bottom of Safari (the square with an arrow pointing up)
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">2</span>
                Scroll down and tap <strong className="text-white mx-1">Add to Home Screen</strong>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">3</span>
                Tap <strong className="text-white mx-1">Add</strong> — the app will appear on your home screen
              </li>
            </ol>
            <p className="text-xs text-gray-500 mt-4">This works in Safari only. Chrome on iOS does not support installation.</p>
          </div>
        </div>
      )}
    </>
  )
}
