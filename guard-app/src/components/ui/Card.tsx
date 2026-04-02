import { ReactNode } from 'react'
import clsx from 'clsx'

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-surface-card rounded-2xl border border-white/5 overflow-hidden', className)}>
      {children}
    </div>
  )
}
