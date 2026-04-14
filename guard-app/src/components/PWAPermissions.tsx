import { useState, useEffect } from 'react'
import { Bell, MapPin, Camera, X, CheckCircle2 } from 'lucide-react'
import { pushApi } from '../api'

const STORAGE_KEY = 'strondis_guard_pwa_permissions_asked'

interface PermStatus {
  notifications: 'granted' | 'denied' | 'default' | 'unsupported'
  geolocation:   'granted' | 'denied' | 'prompt'  | 'unsupported'
  camera:        'granted' | 'denied' | 'prompt'  | 'unsupported'
}

/** Convert a VAPID URL-safe base64 public key to a Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/** Subscribe this device to VAPID push and register with the backend */
async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const reg = await navigator.serviceWorker.ready
    const { key } = await pushApi.getVapidKey()
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
    })
    await pushApi.subscribe(sub.toJSON())
    return true
  } catch (e) {
    console.warn('[PWA] Push subscription failed:', e)
    return false
  }
}

export default function PWAPermissions() {
  const [show, setShow]   = useState(false)
  const [step, setStep]   = useState<'intro' | 'requesting' | 'done'>('intro')
  const [status, setStatus] = useState<PermStatus>({
    notifications: 'default',
    geolocation:   'prompt',
    camera:        'prompt',
  })

  useEffect(() => {
    const asked = localStorage.getItem(STORAGE_KEY)
    if (asked) return

    const checkAndShow = async () => {
      const ns: PermStatus = {
        notifications: 'default',
        geolocation:   'prompt',
        camera:        'prompt',
      }

      if (!('Notification' in window)) {
        ns.notifications = 'unsupported'
      } else {
        ns.notifications = Notification.permission as PermStatus['notifications']
      }

      if ('permissions' in navigator) {
        try {
          const geo = await navigator.permissions.query({ name: 'geolocation' })
          ns.geolocation = geo.state as PermStatus['geolocation']
        } catch {}
        try {
          const cam = await navigator.permissions.query({ name: 'camera' as PermissionName })
          ns.camera = cam.state as PermStatus['camera']
        } catch {}
      }

      setStatus(ns)

      const needsRequest =
        ns.notifications === 'default' ||
        ns.geolocation   === 'prompt'  ||
        ns.camera        === 'prompt'

      if (needsRequest) setShow(true)
    }

    const t = setTimeout(checkAndShow, 1200)
    return () => clearTimeout(t)
  }, [])

  const requestAll = async () => {
    setStep('requesting')

    // 1. Notifications → subscribe to push if granted
    if ('Notification' in window && Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setStatus(s => ({ ...s, notifications: result }))
      if (result === 'granted') {
        await subscribeToPush()
      }
    } else if (status.notifications === 'granted') {
      // Already granted from a previous session — ensure we have a subscription
      await subscribeToPush()
    }

    // 2. Geolocation
    if ('geolocation' in navigator) {
      await new Promise<void>(resolve => {
        navigator.geolocation.getCurrentPosition(
          () => { setStatus(s => ({ ...s, geolocation: 'granted' })); resolve() },
          () => { setStatus(s => ({ ...s, geolocation: 'denied'  })); resolve() },
          { timeout: 8000 }
        )
      })
    }

    // 3. Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setStatus(s => ({ ...s, camera: 'granted' }))
    } catch {
      setStatus(s => ({ ...s, camera: 'denied' }))
    }

    setStep('done')
    localStorage.setItem(STORAGE_KEY, 'asked')
  }

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
      onClick={step === 'done' ? dismiss : undefined}
    >
      <div
        className="bg-surface-card border border-white/10 rounded-t-3xl w-full max-w-lg pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-7">
          {step === 'done' ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 size={40} className="text-green-400 mx-auto" />
              <h3 className="font-bold text-white text-lg">You're all set!</h3>
              <p className="text-white/40 text-sm">
                Strondis Guard will notify you about shifts, messages, and reminders.
              </p>
              <button onClick={dismiss} className="w-full mt-2 py-4 bg-brand-600 text-white font-semibold rounded-xl">
                Get Started
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-base">Allow App Permissions</h3>
                <button onClick={dismiss} className="text-white/30 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
              <p className="text-white/40 text-sm mb-5">
                For the best experience, Strondis Guard needs the following permissions.
              </p>

              <div className="space-y-3 mb-6">
                <PermRow
                  icon={<Bell size={16} className="text-yellow-400" />}
                  label="Notifications"
                  desc="Shift alerts, messages, clock-in reminders"
                  status={status.notifications}
                />
                <PermRow
                  icon={<MapPin size={16} className="text-green-400" />}
                  label="Location"
                  desc="Verify on-site presence at clock-in/out"
                  status={status.geolocation}
                />
                <PermRow
                  icon={<Camera size={16} className="text-brand-400" />}
                  label="Camera"
                  desc="Face ID verification for clock-in"
                  status={status.camera}
                />
              </div>

              <button
                onClick={requestAll}
                disabled={step === 'requesting'}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
              >
                {step === 'requesting' ? 'Requesting…' : 'Allow All'}
              </button>
              <button onClick={dismiss} className="w-full mt-2 py-2 text-white/30 hover:text-white/60 text-sm transition-colors">
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PermRow({
  icon, label, desc, status,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  status: string
}) {
  const badge =
    status === 'granted'     ? <span className="text-xs text-green-400 shrink-0">Granted</span>  :
    status === 'denied'      ? <span className="text-xs text-red-400 shrink-0">Denied</span>     :
    status === 'unsupported' ? <span className="text-xs text-white/20 shrink-0">N/A</span>       :
                               <span className="text-xs text-white/30 shrink-0">Required</span>

  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
      <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-white/30 text-xs truncate">{desc}</p>
      </div>
      {badge}
    </div>
  )
}
