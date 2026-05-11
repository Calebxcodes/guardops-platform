import { Router, Response } from 'express'
import { query } from '../db/pool'
import { requireAdmin } from './adminAuth'
import { requirePermission } from '../middleware/rbac'
import { preventSelfDemotion } from '../middleware/roleChangeGuard'
import { inviteUser, acceptInvitation, resendInvitation, notifyRoleChange } from '../services/userInvitationService'
import jwt from 'jsonwebtoken'
import * as Sentry from '@sentry/node'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET!

// GET /api/admin/users — list all team members
router.get('/', requireAdmin, requirePermission('users', 'read'), async (req: any, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, role, invitation_accepted, created_at
       FROM admin_users
       ORDER BY created_at ASC`,
      [],
      req.tenantId
    )
    res.json({ success: true, users: rows })
  } catch (err: any) {
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/admin/users/invite — invite a new team member (owner or manager)
router.post('/invite', requireAdmin, requirePermission('users', 'invite'), async (req: any, res: Response) => {
  const { email, name, role } = req.body
  if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email is required' })
  const validRoles = ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer']
  if (!role || !validRoles.includes(role))
    return res.status(400).json({ success: false, message: 'Valid role is required' })

  try {
    const result = await inviteUser({
      tenantId: req.tenantId,
      email: email.trim().toLowerCase(),
      name: name?.trim() || '',
      role,
      invitedByAdminId: req.adminId,
    })
    res.status(201).json({ success: true, user: result })
  } catch (err: any) {
    if (err.message.includes('already exists'))
      return res.status(409).json({ success: false, message: err.message })
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/admin/users/:userId/resend-invite — resend invitation link
router.post('/:userId/resend-invite', requireAdmin, requirePermission('users', 'invite'), async (req: any, res: Response) => {
  try {
    await resendInvitation(req.tenantId, parseInt(req.params.userId, 10))
    res.json({ success: true, message: 'Invitation resent successfully' })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// PUT /api/admin/users/:userId/role — change a user's role (owner only, cannot self-demote)
router.put('/:userId/role', requireAdmin, preventSelfDemotion, requirePermission('users', 'changeRole'), async (req: any, res: Response) => {
  const { role } = req.body
  const validRoles = ['owner', 'manager', 'scheduler', 'payroll_manager', 'viewer']
  if (!role || !validRoles.includes(role))
    return res.status(400).json({ success: false, message: 'Valid role is required' })

  try {
    const { rows: existing } = await query(
      'SELECT id, email, role FROM admin_users WHERE id = $1',
      [parseInt(req.params.userId, 10)],
      req.tenantId
    )
    if (!existing[0]) return res.status(404).json({ success: false, message: 'User not found' })

    await query(
      'UPDATE admin_users SET role = $1 WHERE id = $2',
      [role, parseInt(req.params.userId, 10)],
      req.tenantId
    )

    await query(
      `INSERT INTO audit_log (user_type, user_id, action, resource_type, resource_id, ip_address)
       VALUES ('admin', $1, 'ROLE_CHANGED', 'admin_users', $2, $3)`,
      [req.adminId, parseInt(req.params.userId, 10), req.ip ?? null],
      req.tenantId
    )

    // Fire-and-forget email notification
    notifyRoleChange(existing[0].email, existing[0].role, role).catch(() => {})

    res.json({ success: true, message: 'Role updated. User must log out and back in to see changes.' })
  } catch (err: any) {
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE /api/admin/users/:userId — remove a team member (owner only)
router.delete('/:userId', requireAdmin, preventSelfDemotion, requirePermission('users', 'delete'), async (req: any, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT id FROM admin_users WHERE id = $1',
      [parseInt(req.params.userId, 10)],
      req.tenantId
    )
    if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' })

    await query(
      'DELETE FROM admin_users WHERE id = $1',
      [parseInt(req.params.userId, 10)],
      req.tenantId
    )

    await query(
      `INSERT INTO audit_log (user_type, user_id, action, resource_type, resource_id, ip_address)
       VALUES ('admin', $1, 'USER_DELETED', 'admin_users', $2, $3)`,
      [req.adminId, parseInt(req.params.userId, 10), req.ip ?? null],
      req.tenantId
    )

    res.json({ success: true, message: 'Team member removed' })
  } catch (err: any) {
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/admin/users/invite-info — public: get invitation metadata by token
router.get('/invite-info', async (req: any, res: Response) => {
  const { token, tenantId } = req.query
  if (!token || !tenantId)
    return res.status(400).json({ success: false, message: 'token and tenantId are required' })

  try {
    const now = Math.floor(Date.now() / 1000)
    const { rows } = await query(
      `SELECT id, email, name, role, invitation_expires_at, invitation_accepted
       FROM admin_users WHERE invitation_token = $1`,
      [token as string],
      parseInt(tenantId as string, 10)
    )
    const user = rows[0]
    if (!user) return res.status(404).json({ success: false, message: 'Invalid invitation link' })
    if (user.invitation_accepted)
      return res.status(400).json({ success: false, message: 'This invitation has already been used' })
    if (Number(user.invitation_expires_at) < now)
      return res.status(400).json({ success: false, message: 'This invitation has expired' })

    res.json({ success: true, email: user.email, name: user.name, role: user.role })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// POST /api/admin/users/accept-invite — public: accept invitation and set password
router.post('/accept-invite', async (req: any, res: Response) => {
  const { token, password, tenantId } = req.body
  if (!token) return res.status(400).json({ success: false, message: 'Invitation token required' })
  if (!password || password.length < 10)
    return res.status(400).json({ success: false, message: 'Password must be at least 10 characters' })
  if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' })

  try {
    const user = await acceptInvitation(parseInt(tenantId, 10), token, password)

    const jwtToken = jwt.sign(
      { adminId: user.adminId, email: user.email, role: 'admin', adminRole: user.role, tenantId: parseInt(tenantId, 10) },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      success: true,
      token: jwtToken,
      admin: { id: user.adminId, name: user.name, email: user.email, role: user.role, tenantId: parseInt(tenantId, 10) },
    })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
})

export default router
