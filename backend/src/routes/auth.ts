import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query } from '../db/schema'
import { signToken, requireAuth, AuthRequest } from '../middleware/auth'
import { sendPasswordReset } from '../services/email'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const { rows: guardRows } = await query('SELECT * FROM guards WHERE email = $1 AND active = 1', [email])
  const guard = guardRows[0]
  if (!guard) return res.status(401).json({ error: 'Invalid email or password' })

  const { rows: authRows } = await query('SELECT * FROM guard_auth WHERE guard_id = $1', [guard.id])
  const auth = authRows[0]
  if (!auth) return res.status(401).json({ error: 'Account not set up. Contact your manager.' })

  const valid = await bcrypt.compare(password, auth.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

  const token = signToken(guard.id, guard.email)
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
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  const { rows } = await query('SELECT * FROM guard_auth WHERE guard_id = $1', [req.guardId])
  const auth = rows[0]
  if (!auth) return res.status(400).json({ error: 'Auth record not found' })
  const valid = await bcrypt.compare(current_password, auth.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
  const hash = await bcrypt.hash(new_password, 10)
  await query('UPDATE guard_auth SET password_hash = $1 WHERE guard_id = $2', [hash, req.guardId])
  res.json({ success: true })
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const { rows: guardRows } = await query('SELECT id FROM guards WHERE email = $1 AND active = 1', [email])
  // Always return 200 to prevent email enumeration
  if (!guardRows[0]) return res.json({ message: 'If that email is registered, a reset link has been sent.' })

  const token      = crypto.randomBytes(32).toString('hex')
  const tokenHash  = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt  = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Invalidate any existing tokens for this user
  await query(`UPDATE password_reset_tokens SET used = 1 WHERE user_type = 'guard' AND user_id = $1`, [guardRows[0].id])
  // Store the SHA-256 hash — raw token is sent only in the email, never persisted
  await query(
    `INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at) VALUES ('guard', $1, $2, $3)`,
    [guardRows[0].id, tokenHash, expiresAt.toISOString()]
  )

  await sendPasswordReset(email, token, 'guard')
  res.json({ message: 'If that email is registered, a reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' })
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const { rows } = await query(`
    SELECT * FROM password_reset_tokens
    WHERE token = $1 AND user_type = 'guard' AND used = 0 AND expires_at > NOW()
  `, [tokenHash])
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })

  const hash = await bcrypt.hash(new_password, 10)
  await query(
    `INSERT INTO guard_auth (guard_id, password_hash) VALUES ($1, $2)
     ON CONFLICT (guard_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [rows[0].user_id, hash]
  )
  await query(`UPDATE password_reset_tokens SET used = 1 WHERE id = $1`, [rows[0].id])
  res.json({ message: 'Password updated successfully' })
})

export default router
