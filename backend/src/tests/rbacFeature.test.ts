import { describe, it, expect } from 'vitest'
import { requireFeature } from '../middleware/rbac'

function run(feature: string, role: string, method: string, path = '/', overrides?: Record<string, string>) {
  let status = 0
  let passed = false
  const res: any = { status: (s: number) => { status = s; return { json: () => undefined } } }
  requireFeature(feature, overrides)({ adminRole: role, method, path } as any, res, () => { passed = true })
  return passed ? 'next' : status
}

describe('feature-level role checks (finding #7)', () => {
  it('viewers and schedulers cannot edit or approve timesheets', () => {
    expect(run('timesheets', 'viewer', 'PUT', '/1')).toBe(403)
    expect(run('timesheets', 'scheduler', 'PUT', '/1')).toBe(403)
    expect(run('timesheets', 'viewer', 'POST', '/bulk-approve')).toBe(403)
    expect(run('timesheets', 'scheduler', 'POST', '/bulk-approve')).toBe(403)
  })

  it('payroll staff, managers and owners can', () => {
    for (const role of ['owner', 'manager', 'payroll_manager']) {
      expect(run('timesheets', role, 'PUT', '/1')).toBe('next')
      expect(run('timesheets', role, 'POST', '/bulk-approve')).toBe('next')
    }
  })

  it('only owners and managers change sites and clients (billing and pay rates)', () => {
    for (const feature of ['sites', 'clients']) {
      for (const role of ['scheduler', 'payroll_manager', 'viewer']) {
        expect(run(feature, role, 'POST')).toBe(403)
        expect(run(feature, role, 'PUT', '/1')).toBe(403)
        expect(run(feature, role, 'DELETE', '/1')).toBe(403)
        expect(run(feature, role, 'GET')).toBe('next')
      }
      expect(run(feature, 'manager', 'PUT', '/1')).toBe('next')
    }
  })

  it('a missing role is treated as the least privileged', () => {
    expect(run('sites', undefined as any, 'PUT', '/1')).toBe(403)
  })

  it('tax documents are readable only by payroll staff, managers and owners', () => {
    expect(run('taxdocs', 'viewer', 'GET', '/admin/guards/1')).toBe(403)
    expect(run('taxdocs', 'scheduler', 'GET', '/admin/guards/1')).toBe(403)
    expect(run('taxdocs', 'payroll_manager', 'GET', '/admin/guards/1')).toBe('next')
  })

  it('per-route overrides map an action explicitly', () => {
    expect(run('messages', 'viewer', 'POST', '/stream-token', { 'POST /stream-token': 'read' })).toBe('next')
    expect(run('messages', 'viewer', 'POST', '/send', { 'POST /stream-token': 'read' })).toBe(403)
  })
})
