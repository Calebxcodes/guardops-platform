import { Response, NextFunction } from 'express'

export type RoleType = 'owner' | 'manager' | 'scheduler' | 'payroll_manager' | 'viewer'

const PERMISSIONS: Record<string, Record<string, RoleType[]>> = {
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

const ROLE_DISPLAY: Record<string, string> = {
  owner:           'Owner',
  manager:         'Manager',
  scheduler:       'Scheduler',
  payroll_manager: 'Payroll Manager',
  viewer:          'Viewer',
}

export function requirePermission(feature: string, action: string) {
  return (req: any, res: Response, next: NextFunction) => {
    const role: RoleType = req.adminRole || 'viewer'
    const allowed = PERMISSIONS[feature]?.[action] ?? []

    if (!allowed.includes(role)) {
      const requiredRoles = allowed.map(r => ROLE_DISPLAY[r] || r).join('/')
      return res.status(403).json({
        success: false,
        message: `Your role: ${ROLE_DISPLAY[role] || role}. Required: ${requiredRoles || 'Owner'}`,
      })
    }

    next()
  }
}
