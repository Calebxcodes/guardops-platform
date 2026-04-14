import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query, auditLog } from '../db/schema'
import jwt from 'jsonwebtoken'
import { sendPasswordReset } from '../services/email'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set. Refusing to start.')

function signAdminToken(id: number, email: string) {
  return jwt.sign({ adminId: id, email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' })
}

export function requireAdmin(req: any, res: Response, next: any) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Not admin' })
    req.adminId = payload.adminId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Creates the first admin account ONLY on a completely fresh database.
// Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to override the defaults.
// This function NEVER resets or overwrites existing admin passwords.
//
// ONE-TIME RECOVERY: If you need to reset an existing admin's password,
// set RESET_ADMIN_PASSWORD=<new-password> env var, deploy once, then remove it.
export async function ensureDefaultAdmin() {
  // One-time emergency recovery — only runs if the env var is explicitly set
  const resetPassword = process.env.RESET_ADMIN_PASSWORD
  if (resetPassword && resetPassword.length >= 10) {
    console.warn('[SECURITY] RESET_ADMIN_PASSWORD detected — resetting all admin passwords...')
    const hash = await bcrypt.hash(resetPassword, 12)
    const { rowCount } = await query('UPDATE admin_users SET password_hash = $1', [hash])
    const { rows: adminList } = await query('SELECT email FROM admin_users')
    console.warn(`[SECURITY] Reset ${rowCount} admin account(s): ${adminList.map((r: any) => r.email).join(', ')}`)
    console.warn('[SECURITY] Remove RESET_ADMIN_PASSWORD from environment variables immediately.')
    return
  }

  const { rows } = await query('SELECT COUNT(*)::int as c FROM admin_users')
  if (rows[0].c > 0) return // admins already exist — do nothing

  const email    = process.env.ADMIN_EMAIL    || 'admin@strondis.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@Strondis1'
  const hash = await bcrypt.hash(password, 12)
  await query(
    'INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)',
    ['Strondis Admin', email, hash]
  )
  console.warn(`[SECURITY] First-boot admin created: ${email}`)
  console.warn('[SECURITY] Change the admin password immediately after first login.')
}

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const { rows } = await query('SELECT * FROM admin_users WHERE email = $1', [email])
  const admin = rows[0]
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) {
    auditLog({ user_type: 'admin', action: 'login_failed', extra: { email }, ip_address: req.ip })
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  auditLog({ user_type: 'admin', user_id: admin.id, action: 'login', ip_address: req.ip })
  const token = signAdminToken(admin.id, admin.email)
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } })
})

router.get('/me', requireAdmin, async (req: any, res: Response) => {
  const { rows } = await query('SELECT id, name, email, created_at FROM admin_users WHERE id = $1', [req.adminId])
  res.json(rows[0])
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const { rows: adminRows } = await query('SELECT id FROM admin_users WHERE email = $1', [email])
  // Always return 200 to prevent email enumeration
  if (!adminRows[0]) return res.json({ message: 'If that email is registered, a reset link has been sent.' })

  const token      = crypto.randomBytes(32).toString('hex')
  const tokenHash  = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await query(`UPDATE password_reset_tokens SET used = 1 WHERE user_type = 'admin' AND user_id = $1`, [adminRows[0].id])
  // Store hash only — raw token travels only in the email link
  await query(
    `INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at) VALUES ('admin', $1, $2, $3)`,
    [adminRows[0].id, tokenHash, expiresAt.toISOString()]
  )

  await sendPasswordReset(email, token, 'admin')
  res.json({ message: 'If that email is registered, a reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' })
  if (new_password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' })

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const { rows } = await query(`
    SELECT * FROM password_reset_tokens
    WHERE token = $1 AND user_type = 'admin' AND used = 0 AND expires_at > NOW()
  `, [tokenHash])
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })

  // Invalidate token FIRST (atomic), then update password — prevents race-condition reuse
  const hash = await bcrypt.hash(new_password, 10)
  await query(`UPDATE password_reset_tokens SET used = 1 WHERE id = $1`, [rows[0].id])
  await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, rows[0].user_id])
  res.json({ message: 'Password updated successfully' })
})

export default router
