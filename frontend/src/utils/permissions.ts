export const ROLES = ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'] as const
export type RoleType = typeof ROLES[number]

export const ROLE_LABELS: Record<RoleType, string> = {
  owner:           'Owner',
  manager:         'Manager',
  scheduler:       'Scheduler',
  payroll_manager: 'Payroll Manager',
  viewer:          'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  owner:           'Full access to all features, team management, and settings',
  manager:         'Manage guards, shifts, payroll, and team (excludes sensitive billing)',
  scheduler:       'Create and manage shifts (guards view, scheduling, incidents view only)',
  payroll_manager: 'Process and manage payroll (payroll and reports only)',
  viewer:          'Read-only access to all features',
}

export const FEATURE_PERMISSIONS: Record<string, Record<string, RoleType[]>> = {
  guards: {
    create:  ['owner', 'manager'],
    read:    ['owner', 'manager', 'scheduler', 'viewer'],
    update:  ['owner', 'manager'],
    delete:  ['owner', 'manager'],
    suspend: ['owner', 'manager'],
  },
  shifts: {
    create: ['owner', 'manager', 'scheduler'],
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    update: ['owner', 'manager', 'scheduler'],
    delete: ['owner', 'manager', 'scheduler'],
  },
  payroll: {
    create: ['owner', 'manager', 'payroll_manager'],
    read:   ['owner', 'manager', 'payroll_manager', 'viewer'],
    update: ['owner', 'manager', 'payroll_manager'],
    delete: ['owner', 'manager', 'payroll_manager'],
  },
  incidents: {
    create: ['owner', 'manager'],
    read:   ['owner', 'manager', 'scheduler', 'viewer'],
    update: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  reports: {
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    create: ['owner', 'manager'],
    update: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  users: {
    create:     ['owner', 'manager'],
    read:       ['owner', 'manager'],
    update:     ['owner'],
    delete:     ['owner'],
    invite:     ['owner', 'manager'],
    changeRole: ['owner'],
  },
  settings: {
    read:   ['owner', 'manager'],
    update: ['owner', 'manager'],
  },
}

export function canPerform(role: RoleType, feature: string, action: string): boolean {
  return (FEATURE_PERMISSIONS[feature]?.[action] ?? []).includes(role)
}

// Which nav paths a given role can access
export const NAV_ACCESS: Record<string, RoleType[]> = {
  '/':              ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
  '/guards':        ['owner', 'manager', 'scheduler', 'viewer'],
  '/sites':         ['owner', 'manager', 'viewer'],
  '/scheduling':    ['owner', 'manager', 'scheduler', 'viewer'],
  '/timesheets':    ['owner', 'manager', 'scheduler', 'viewer'],
  '/payroll':       ['owner', 'manager', 'payroll_manager', 'viewer'],
  '/financial':     ['owner', 'manager', 'payroll_manager', 'viewer'],
  '/analytics':     ['owner', 'manager', 'payroll_manager', 'viewer'],
  '/incidents':     ['owner', 'manager', 'scheduler', 'viewer'],
  '/compliance':    ['owner', 'manager', 'viewer'],
  '/hr':            ['owner', 'manager'],
  '/portal':        ['owner', 'manager', 'viewer'],
  '/messages':      ['owner', 'manager'],
  '/notifications': ['owner', 'manager'],
  '/documents':     ['owner', 'manager', 'viewer'],
  '/settings':       ['owner', 'manager'],
  '/settings/users': ['owner', 'manager'],
}

export function canAccessNav(role: RoleType, path: string): boolean {
  return (NAV_ACCESS[path] ?? ['owner']).includes(role)
}

export function canAccessSettings(role: RoleType, settingKey?: string): boolean {
  if (role === 'owner') return true
  if (role === 'manager') {
    const forbidden = ['billing', 'apiKeys', 'stripe', 'dangerZone', 'company', 'support']
    return !forbidden.includes(settingKey || '')
  }
  return false
}
