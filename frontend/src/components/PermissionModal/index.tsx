// Phase 2 — Permission consent modal (foundation only, NOT rendered in the app yet).
// Activated in Phase 2 when triggered after first login or before using a feature
// that requires explicit consent (location, push notifications, analytics).
//
// To activate: import and render <PermissionModal /> inside App.tsx after auth succeeds,
// conditioned on !consentGiven stored in localStorage or the permissions API.

import { useState } from 'react'
import { Shield, MapPin, Bell, BarChart2, HeadphonesIcon, Check, X, Sliders } from 'lucide-react'

export interface PermissionSet {
  location_access:       boolean
  push_notifications:    boolean
  analytics_consent:     boolean
  support_consent:       boolean
}

interface Props {
  onAcceptAll:   (perms: PermissionSet) => void
  onSkip:        () => void
  onCustomize?:  (perms: PermissionSet) => void
  companyName?:  string
}

const DEFAULT_PERMS: PermissionSet = {
  location_access:    true,
  push_notifications: true,
  analytics_consent:  true,
  support_consent:    true,
}

const PERMISSION_ITEMS: {
  key: keyof PermissionSet
  label: string
  description: string
  icon: React.ElementType
}[] = [
  {
    key: 'location_access',
    label: 'Location Access',
    description: 'Required for GPS clock-in, geofencing, and site verification.',
    icon: MapPin,
  },
  {
    key: 'push_notifications',
    label: 'Push Notifications',
    description: 'Receive shift reminders, incident alerts, and schedule changes.',
    icon: Bell,
  },
  {
    key: 'analytics_consent',
    label: 'Usage Analytics',
    description: 'Help improve the platform by sharing anonymised usage data.',
    icon: BarChart2,
  },
  {
    key: 'support_consent',
    label: 'Support Access',
    description: 'Allow support staff to view anonymised data when resolving tickets.',
    icon: HeadphonesIcon,
  },
]

export default function PermissionModal({ onAcceptAll, onSkip, onCustomize, companyName }: Props) {
  const [customizeMode, setCustomizeMode] = useState(false)
  const [perms, setPerms] = useState<PermissionSet>({ ...DEFAULT_PERMS })

  const toggle = (key: keyof PermissionSet) =>
    setPerms(p => ({ ...p, [key]: !p[key] }))

  const handleCustomizeSave = () => {
    if (onCustomize) onCustomize(perms)
    else onAcceptAll(perms)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-blue-600 rounded-t-2xl p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Shield size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold">Before you continue</h2>
          <p className="text-blue-100 text-sm mt-1">
            {companyName ? `${companyName} uses` : 'Strondis uses'} these permissions to keep your experience seamless.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {PERMISSION_ITEMS.map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="flex items-start gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
              {customizeMode && (
                <button
                  onClick={() => toggle(key)}
                  className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${
                    perms[key] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    perms[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              )}
              {!customizeMode && (
                <Check size={16} className="text-green-500 shrink-0 mt-1" />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          {customizeMode ? (
            <>
              <button
                onClick={handleCustomizeSave}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                Save my preferences
              </button>
              <button
                onClick={() => setCustomizeMode(false)}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
              >
                ← Back
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAcceptAll(DEFAULT_PERMS)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
              >
                <Check size={16} /> Accept All &amp; Continue
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomizeMode(true)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sliders size={14} /> Customize
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-500 text-sm font-medium rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X size={14} /> Skip for now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
