import { X, Shield, ScanFace, MapPin, Bell, Lock, FileText } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function PrivacyDialog({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900">Privacy & Data</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-gray-600">
          <p className="text-gray-500">
            Strondis Ops is operated by <strong className="text-gray-800">Strondis Security Ltd</strong>. This summary explains what personal data we collect, why, and how we protect it.
          </p>

          <Section icon={<ScanFace size={16} className="text-blue-600" />} title="Facial Biometric Data">
            <p>
              Officer clock-in uses <strong>facial recognition</strong> to verify identity. A mathematical descriptor of your face (not a photograph) is stored encrypted in our database. This data is:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
              <li>Used solely for clock-in/out verification</li>
              <li>Never shared with third parties</li>
              <li>Deleted immediately upon account closure</li>
              <li>Protected under UK GDPR as special category biometric data</li>
            </ul>
            <p className="mt-2 text-gray-500">Officers can remove their Face ID at any time from the Profile page.</p>
          </Section>

          <Section icon={<MapPin size={16} className="text-green-600" />} title="Location Data">
            <p>
              GPS coordinates are captured at clock-in and clock-out to verify officers are on-site. Location is only recorded during those specific actions — we do not continuously track location.
            </p>
          </Section>

          <Section icon={<Bell size={16} className="text-yellow-600" />} title="Notifications">
            <p>
              Push notifications are used to alert officers of new shifts, schedule changes, and operational messages. You can withdraw notification consent at any time in your device settings.
            </p>
          </Section>

          <Section icon={<FileText size={16} className="text-purple-600" />} title="Data We Collect">
            <ul className="space-y-1 list-disc list-inside text-gray-500">
              <li>Name, email address, phone number</li>
              <li>Employment and payroll details</li>
              <li>SIA licence numbers and certifications</li>
              <li>Shift and timesheet records</li>
              <li>Facial biometric descriptor (officers only)</li>
              <li>Clock-in/out GPS coordinates</li>
            </ul>
          </Section>

          <Section icon={<Lock size={16} className="text-red-500" />} title="Your Rights (UK GDPR)">
            <p>You have the right to:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2 text-gray-500">
              Contact us at <strong className="text-gray-800">info@strondis.com</strong> to exercise any of these rights.
            </p>
          </Section>

          <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
            For our full Privacy Policy visit <strong>strondis.com/privacy</strong>. Last reviewed: April 2026.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}
