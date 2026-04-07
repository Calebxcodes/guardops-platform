import { LogOut, Clock } from 'lucide-react'

interface Props {
  secondsLeft: number
  onStay:   () => void
  onLogout: () => void
}

export default function SessionTimeoutModal({ secondsLeft, onStay, onLogout }: Props) {
  const pct = (secondsLeft / 60) * 100

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-surface-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-xs p-6">
        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center justify-center mb-3">
            <Clock size={28} className="text-yellow-400" />
          </div>
          <h2 className="text-white text-base font-semibold">Session expiring</h2>
          <p className="text-white/40 text-sm mt-1">
            You've been inactive for 30 minutes. You'll be logged out automatically.
          </p>
        </div>

        {/* Countdown ring */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={secondsLeft <= 15 ? '#f87171' : '#facc15'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${secondsLeft <= 15 ? 'text-red-400' : 'text-white'}`}>
              {secondsLeft}
            </span>
          </div>
          <p className="text-white/30 text-xs mt-2">seconds remaining</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 text-sm font-medium transition-colors"
          >
            <LogOut size={15} />
            Log out
          </button>
          <button
            onClick={onStay}
            className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  )
}
