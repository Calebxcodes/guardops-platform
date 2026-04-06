import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query } from '../db/schema'
import jwt from 'jsonwebtoken'
import { sendPasswordReset } from '../services/email'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'strondis-admin-secret-change-in-prod'

function signAdminToken(id: number, email: string) {
  return jwt.sign({ adminId: id, email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
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

export async function ensureDefaultAdmin() {
  const { rows } = await query('SELECT COUNT(*)::int as c FROM admin_users')
  if (rows[0].c === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    await query(
      'INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Strondis Admin', 'admin@strondis.com', hash]
    )
    console.log('Default admin created: admin@strondis.com / admin123')
  }
}

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const { rows } = await query('SELECT * FROM admin_users WHERE email = $1', [email])
  const admin = rows[0]
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
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

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await query(`UPDATE password_reset_tokens SET used = 1 WHERE user_type = 'admin' AND user_id = $1`, [adminRows[0].id])
  await query(
    `INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at) VALUES ('admin', $1, $2, $3)`,
    [adminRows[0].id, token, expiresAt.toISOString()]
  )

  await sendPasswordReset(email, token, 'admin')
  res.json({ message: 'If that email is registered, a reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' })
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const { rows } = await query(`
    SELECT * FROM password_reset_tokens
    WHERE token = $1 AND user_type = 'admin' AND used = 0 AND expires_at > NOW()
  `, [token])
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })

  const hash = await bcrypt.hash(new_password, 10)
  await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, rows[0].user_id])
  await query(`UPDATE password_reset_tokens SET used = 1 WHERE id = $1`, [rows[0].id])
  res.json({ message: 'Password updated successfully' })
})

export default router
