import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db/schema'
import { signToken, requireAuth, AuthRequest } from '../middleware/auth'

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
  })
})

router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const { current_password, new_password } = req.body
  const { rows } = await query('SELECT * FROM guard_auth WHERE guard_id = $1', [req.guardId])
  const auth = rows[0]
  if (!auth) return res.status(400).json({ error: 'Auth record not found' })
  const valid = await bcrypt.compare(current_password, auth.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
  const hash = await bcrypt.hash(new_password, 10)
  await query('UPDATE guard_auth SET password_hash = $1 WHERE guard_id = $2', [hash, req.guardId])
  res.json({ success: true })
})

export default router
