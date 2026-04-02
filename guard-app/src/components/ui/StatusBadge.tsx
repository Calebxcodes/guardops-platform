import clsx from 'clsx'

const map: Record<string, { label: string; cls: string }> = {
  'on-duty':   { label: 'On Duty',    cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'off-duty':  { label: 'Off Duty',   cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  'on-leave':  { label: 'On Leave',   cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  active:      { label: 'Active',     cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  assigned:    { label: 'Assigned',   cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  unassigned:  { label: 'Unassigned', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  completed:   { label: 'Completed',  cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  cancelled:   { label: 'Cancelled',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  draft:       { label: 'Draft',      cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  submitted:   { label: 'Submitted',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved:    { label: 'Approved',   cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected:    { label: 'Rejected',   cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  minor:       { label: 'Minor',      cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  major:       { label: 'Major',      cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  critical:    { label: 'Critical',   cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  paid:        { label: 'Paid',       cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  pending:     { label: 'Pending',    cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
}

export default function StatusBadge({ status }: { status: string }) {
  const c = map[status] || { label: status, cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', c.cls)}>
      {c.label}
    </span>
  )
}
