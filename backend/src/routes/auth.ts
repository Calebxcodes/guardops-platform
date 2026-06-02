import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { auditLog } from '../db/schema'
import { pool, query } from '../db/pool'
import { signToken, requireAuth, AuthRequest } from '../middleware/auth'
import { sendPasswordReset } from '../services/email'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  // Try tenant-aware login via guard_links bridge table
  const { rows: linkRows } = await pool.query(
    'SELECT tenant_id, guard_id FROM public.guard_links WHERE guard_email = $1 LIMIT 1',
    [email]
  )

  let guard: any
  let tenantId: number | undefined

  if (linkRows[0]) {
    tenantId = Number(linkRows[0].tenant_id)
    const { rows } = await query(
      'SELECT * FROM guards WHERE id = $1 AND active = 1 AND deleted_at IS NULL',
      [linkRows[0].guard_id],
      tenantId
    )
    guard = rows[0]
  } else {
    // Fallback: public schema (legacy / seed guards without a tenant link)
    const { rows } = await query(
      'SELECT * FROM guards WHERE email = $1 AND active = 1 AND deleted_at IS NULL',
      [email]
    )
    guard = rows[0]
  }

  if (!guard) return res.status(401).json({ error: 'Invalid email or password' })

  // Block login for guards awaiting activation or rejected
  if (guard.status === 'pending') {
    return res.status(403).json({
      error: 'Your account is pending admin activation. Please wait for approval.',
      status: 'pending'
    })
  }
  if (guard.status === 'rejected') {
    return res.status(403).json({
      error: 'Your account application was not approved. Please contact your company.',
      status: 'rejected'
    })
  }

  const { rows: authRows } = await query(
    'SELECT * FROM guard_auth WHERE guard_id = $1',
    [guard.id],
    tenantId
  )
  const auth = authRows[0]
  if (!auth) return res.status(401).json({ error: 'Account not set up. Contact your manager.' })

  const valid = await bcrypt.compare(password, auth.password_hash)
  if (!valid) {
    auditLog({ user_type: 'guard', action: 'login_failed', extra: { email }, ip_address: req.ip })
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  auditLog({ user_type: 'guard', user_id: guard.id, action: 'login', ip_address: req.ip })
  const token = signToken(guard.id, guard.email, tenantId)
  res.json({
    token,
    guard: {
      id: guard.id,
      first_name: guard.first_name,
      last_name: guard.last_name,
      email: guard.email,
      phone: guard.phone,
      status: guard.status,
      employment_type: guard.employment_type,
      hourly_rate: guard.hourly_rate,
      certifications: JSON.parse(guard.certifications || '[]'),
      skills: JSON.parse(guard.skills || '[]'),
      avatar_url: guard.avatar_url,
      has_face_id: !!guard.face_descriptor,
    }
  })
})

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await query('SELECT * FROM guards WHERE id = $1', [req.guardId])
  const guard = rows[0]
  if (!guard) return res.status(404).json({ error: 'Guard not found' })
  res.json({
    id: guard.id,
    first_name: guard.first_name,
    last_name: guard.last_name,
    email: guard.email,
    phone: guard.phone,
    address: guard.address,
    status: guard.status,
    employment_type: guard.employment_type,
    hourly_rate: guard.hourly_rate,
    certifications: JSON.parse(guard.certifications || '[]'),
    skills: JSON.parse(guard.skills || '[]'),
    avatar_url: guard.avatar_url,
    created_at: guard.created_at,
    has_face_id: !!guard.face_descriptor,
  })
})

router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const { current_password, new_password } = req.body
  if (!new_password || new_password.length < 10)
    return res.status(400).json({ error: 'New password must be at least 10 characters' })
  const { rows } = await query('SELECT * FROM guard_auth WHERE guard_id = $1', [req.guardId])
  const auth = rows[0]
  if (!auth) return res.status(400).json({ error: 'Auth record not found' })
  const valid = await bcrypt.compare(current_password, auth.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
  const hash = await bcrypt.hash(new_password, 10)
  await query('UPDATE guard_auth SET password_hash = $1 WHERE guard_id = $2', [hash, req.guardId])
  auditLog({ user_type: 'guard', user_id: req.guardId, action: 'password_changed', ip_address: req.ip })
  res.json({ success: true })
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  // Resolve guard and tenant via the public bridge table
  const { rows: linkRows } = await pool.query(
    'SELECT tenant_id, guard_id FROM public.guard_links WHERE guard_email = $1 LIMIT 1',
    [email]
  )
  // Always return 200 to prevent email enumeration
  if (!linkRows[0]) return res.json({ message: 'If that email is registered, a reset link has been sent.' })

  const guardTenantId = Number(linkRows[0].tenant_id)
  const guardId       = Number(linkRows[0].guard_id)

  const { rows: guardRows } = await query(
    'SELECT id FROM guards WHERE id = $1 AND active = 1',
    [guardId],
    guardTenantId
  )
  if (!guardRows[0]) return res.json({ message: 'If that email is registered, a reset link has been sent.' })

  const token     = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  // Invalidate existing tokens (public schema)
  await pool.query(
    `UPDATE password_reset_tokens SET used = 1 WHERE user_type = 'guard' AND user_id = $1 AND tenant_id = $2`,
    [guardId, guardTenantId]
  )
  // Store token with tenant_id so reset-password knows which schema to update
  await pool.query(
    `INSERT INTO password_reset_tokens (user_type, user_id, tenant_id, token, expires_at)
     VALUES ('guard', $1, $2, $3, $4)`,
    [guardId, guardTenantId, tokenHash, expiresAt.toISOString()]
  )

  await sendPasswordReset(email, token, 'guard')
  res.json({ message: 'If that email is registered, a reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' })
  if (new_password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' })

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  // Tokens are in the public schema
  const { rows } = await pool.query(`
    SELECT * FROM password_reset_tokens
    WHERE token = $1 AND user_type = 'guard' AND used = 0 AND expires_at > NOW()
  `, [tokenHash])
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })

  // Invalidate token FIRST to prevent race-condition reuse
  const hash = await bcrypt.hash(new_password, 10)
  await pool.query(`UPDATE password_reset_tokens SET used = 1 WHERE id = $1`, [rows[0].id])

  // Update password in the correct tenant schema
  const resetTenantId = rows[0].tenant_id ? Number(rows[0].tenant_id) : undefined
  await query(
    `INSERT INTO guard_auth (guard_id, password_hash) VALUES ($1, $2)
     ON CONFLICT (guard_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [rows[0].user_id, hash],
    resetTenantId
  )
  res.json({ message: 'Password updated successfully' })
})

export default router
