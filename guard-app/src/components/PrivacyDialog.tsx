import { X, Shield, ScanFace, MapPin, Bell, Lock, FileText } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function PrivacyDialog({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-surface-card border border-white/10 rounded-t-3xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-brand-400" />
            <h2 className="font-bold text-white">Privacy & Data</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1 rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 pb-8 space-y-5 text-sm text-white/60">
          <p>
            Strondis Guard is operated by <strong className="text-white/80">Strondis Security Ltd</strong>. Here's how we use and protect your personal data.
          </p>

          <Section icon={<ScanFace size={15} className="text-brand-400" />} title="Facial Biometric Data">
            <p>
              Clock-in uses <strong className="text-white/80">facial recognition</strong> to confirm your identity. We store a mathematical descriptor of your face — not a photo. This data:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-white/40">
              <li>Is used only for clock-in/out verification</li>
              <li>Is never shared with third parties</li>
              <li>Is encrypted at rest and in transit</li>
              <li>Is deleted immediately if you remove Face ID or close your account</li>
              <li>Is protected as special category biometric data under UK GDPR</li>
            </ul>
            <p className="mt-2 text-white/40">You can remove your Face ID at any time from this page.</p>
          </Section>

          <Section icon={<MapPin size={15} className="text-green-400" />} title="Location Data">
            <p>
              Your GPS position is captured at clock-in and clock-out only, to verify you're on-site. We do not continuously track your location at any other time.
            </p>
          </Section>

          <Section icon={<Bell size={15} className="text-yellow-400" />} title="Notifications">
            <p>
              Push notifications alert you to new shifts, schedule changes, and messages. You can withdraw consent in your device settings at any time.
            </p>
          </Section>

          <Section icon={<FileText size={15} className="text-purple-400" />} title="Data We Collect">
            <ul className="space-y-1 list-disc list-inside text-white/40">
              <li>Name, email, phone number</li>
              <li>Employment type and hourly rate</li>
              <li>SIA licence numbers and certifications</li>
              <li>Shift and timesheet records</li>
              <li>Facial biometric descriptor</li>
              <li>Clock-in/out GPS coordinates</li>
            </ul>
          </Section>

          <Section icon={<Lock size={15} className="text-red-400" />} title="Your Rights (UK GDPR)">
            <p>You have the right to access, correct, delete, or export your data. Contact us:</p>
            <p className="mt-2 font-medium text-white/70">info@strondis.com</p>
            <p className="mt-1 text-white/30 text-xs">Full Privacy Policy at strondis.com/privacy · Last reviewed April 2026</p>
          </Section>
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
        <h3 className="font-semibold text-white/80">{title}</h3>
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}
