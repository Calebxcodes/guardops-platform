import { RoleType, ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../utils/permissions'

interface RoleSelectorProps {
  value: RoleType
  onChange: (role: RoleType) => void
  disabled?: boolean
  label?: string
  showDescriptions?: boolean
  allowedRoles?: RoleType[]
}

export default function RoleSelector({
  value,
  onChange,
  disabled = false,
  label = 'User Role',
  showDescriptions = true,
  allowedRoles = [...ROLES],
}: RoleSelectorProps) {
  if (showDescriptions) {
    return (
      <div className="space-y-2">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
          {allowedRoles.map(role => (
            <label
              key={role}
              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                value === role ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="role-selector"
                value={role}
                checked={value === role}
                onChange={() => !disabled && onChange(role)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{ROLE_LABELS[role]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value as RoleType)}
        disabled={disabled}
        className="block w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
      >
        {allowedRoles.map(role => (
          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
        ))}
      </select>
    </div>
  )
}
