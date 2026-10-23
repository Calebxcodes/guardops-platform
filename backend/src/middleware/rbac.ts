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
  // Sites and clients carry the billing and pay rates.
  sites: {
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    create: ['owner', 'manager'],
    update: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  clients: {
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    create: ['owner', 'manager'],
    update: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  // Timesheets are what payroll pays on.
  timesheets: {
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    create: ['owner', 'manager', 'payroll_manager'],
    update: ['owner', 'manager', 'payroll_manager'],
    delete: ['owner', 'manager', 'payroll_manager'],
  },
  documents: {
    read:   ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer'],
    create: ['owner', 'manager'],
    update: ['owner', 'manager'],
    delete: ['owner', 'manager'],
  },
  compliance: {
    read:   ['owner', 'manager', 'scheduler', 'viewer'],
  },
  messages: {
    read:   ['owner', 'manager', 'scheduler', 'viewer'],
    create: ['owner', 'manager', 'scheduler'],
  },
  timeoff: {
    read:   ['owner', 'manager', 'scheduler', 'viewer'],
    update: ['owner', 'manager', 'scheduler'],
  },
  badges: {
    read:   ['owner', 'manager', 'scheduler', 'viewer'],
  },
  // HMRC documents: payroll staff only.
  taxdocs: {
    read:   ['owner', 'manager', 'payroll_manager'],
  },
}

const METHOD_ACTION: Record<string, string> = {
  GET: 'read', HEAD: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete',
}

/**
 * Router-level check for a whole feature: the action comes from the HTTP
 * method, so a route added later is covered without remembering to add a check.
 * `overrides` maps "METHOD /path" (path relative to the mount) to an action.
 * Must be mounted after requireAdmin, which sets req.adminRole.
 */
export function requireFeature(feature: string, overrides: Record<string, string> = {}) {
  return (req: any, res: Response, next: NextFunction) => {
    const action = overrides[`${req.method} ${req.path}`] ?? METHOD_ACTION[req.method] ?? 'update'
    return requirePermission(feature, action)(req, res, next)
  }
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
