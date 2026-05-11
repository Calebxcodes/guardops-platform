import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '../db/pool'
import { pool } from '../db/pool'
import { sendInvitation, sendRoleChangeNotification } from './email'

export type RoleType = 'owner' | 'manager' | 'scheduler' | 'payroll_manager' | 'viewer'

interface InviteParams {
  tenantId: number
  email: string
  name: string
  role: RoleType
  invitedByAdminId: number
}

export async function inviteUser(params: InviteParams) {
  const { tenantId, email, name, role, invitedByAdminId } = params

  const { rows: existing } = await query(
    'SELECT id FROM admin_users WHERE email = $1',
    [email],
    tenantId
  )
  if (existing[0]) throw new Error('A user with this email already exists')

  const token = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours

  const { rows } = await query(
    `INSERT INTO admin_users (name, email, role, invitation_token, invitation_expires_at, invitation_accepted)
     VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
    [name || email, email, role, token, expiresAt],
    tenantId
  )

  const userId = rows[0].id

  const { rows: tenantRows } = await pool.query(
    'SELECT name FROM public.tenants WHERE id = $1',
    [tenantId]
  )
  const tenantName = tenantRows[0]?.name || 'Strondis'

  await sendInvitation(email, token, role, tenantName, tenantId)

  await query(
    `INSERT INTO audit_log (user_type, user_id, action, resource_type, resource_id, ip_address)
     VALUES ('admin', $1, 'USER_INVITED', 'admin_users', $2, NULL)`,
    [invitedByAdminId, userId],
    tenantId
  )

  return { userId, email, role }
}

export async function acceptInvitation(
  tenantId: number,
  token: string,
  password: string
): Promise<{ adminId: number; email: string; name: string; role: string }> {
  const now = Math.floor(Date.now() / 1000)

  const { rows } = await query(
    `SELECT id, email, name, role, invitation_expires_at, invitation_accepted
     FROM admin_users WHERE invitation_token = $1`,
    [token],
    tenantId
  )

  const user = rows[0]
  if (!user) throw new Error('Invalid invitation link')
  if (user.invitation_accepted) throw new Error('This invitation has already been used')
  if (Number(user.invitation_expires_at) < now)
    throw new Error('This invitation link has expired. Please ask to be reinvited.')

  const hash = await bcrypt.hash(password, 12)

  await query(
    `UPDATE admin_users
     SET password_hash = $1, invitation_accepted = 1, invitation_token = NULL, invitation_expires_at = NULL
     WHERE id = $2`,
    [hash, user.id],
    tenantId
  )

  return { adminId: user.id, email: user.email, name: user.name, role: user.role }
}

export async function resendInvitation(tenantId: number, userId: number): Promise<void> {
  const token = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60

  const { rows } = await query(
    `UPDATE admin_users SET invitation_token = $1, invitation_expires_at = $2
     WHERE id = $3 AND invitation_accepted = 0
     RETURNING email, role`,
    [token, expiresAt, userId],
    tenantId
  )

  if (!rows[0]) throw new Error('User not found or has already accepted their invitation')

  const { rows: tenantRows } = await pool.query(
    'SELECT name FROM public.tenants WHERE id = $1',
    [tenantId]
  )
  const tenantName = tenantRows[0]?.name || 'Strondis'

  await sendInvitation(rows[0].email, token, rows[0].role, tenantName, tenantId)
}

export async function notifyRoleChange(email: string, oldRole: string, newRole: string): Promise<void> {
  await sendRoleChangeNotification(email, oldRole, newRole)
}
