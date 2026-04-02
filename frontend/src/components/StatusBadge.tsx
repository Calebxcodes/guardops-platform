import clsx from 'clsx'

const statusConfig: Record<string, { label: string; className: string }> = {
  'on-duty': { label: 'On Duty', className: 'bg-green-100 text-green-800' },
  'off-duty': { label: 'Off Duty', className: 'bg-gray-100 text-gray-700' },
  'on-leave': { label: 'On Leave', className: 'bg-yellow-100 text-yellow-800' },
  inactive: { label: 'Inactive', className: 'bg-red-100 text-red-700' },
  unassigned: { label: 'Unassigned', className: 'bg-red-100 text-red-700' },
  assigned: { label: 'Assigned', className: 'bg-blue-100 text-blue-700' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  minor: { label: 'Minor', className: 'bg-yellow-100 text-yellow-800' },
  major: { label: 'Major', className: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-800' },
  'full-time': { label: 'Full-Time', className: 'bg-blue-100 text-blue-700' },
  'part-time': { label: 'Part-Time', className: 'bg-purple-100 text-purple-700' },
  'on-call': { label: 'On-Call', className: 'bg-orange-100 text-orange-700' },
  contractor: { label: 'Contractor', className: 'bg-teal-100 text-teal-700' },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={clsx('badge', config.className)}>
      {config.label}
    </span>
  )
}
