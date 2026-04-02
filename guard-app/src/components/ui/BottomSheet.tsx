import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <div className="w-10 h-1 bg-white/20 rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
