import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/schema'
import { signToken, requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// Login
router.post('/login', async (req: Request, res: Response) => {
  const db = getDb()
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const guard = db.prepare('SELECT * FROM guards WHERE email = ? AND active = 1').get(email) as any
  if (!guard) return res.status(401).json({ error: 'Invalid email or password' })

  const auth = db.prepare('SELECT * FROM guard_auth WHERE guard_id = ?').get(guard.id) as any
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

// Get current guard profile
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const db = getDb()
  const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.guardId) as any
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

// Change password
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { current_password, new_password } = req.body
  const auth = db.prepare('SELECT * FROM guard_auth WHERE guard_id = ?').get(req.guardId) as any
  if (!auth) return res.status(400).json({ error: 'Auth record not found' })
  const valid = await bcrypt.compare(current_password, auth.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
  const hash = await bcrypt.hash(new_password, 10)
  db.prepare('UPDATE guard_auth SET password_hash = ? WHERE guard_id = ?').run(hash, req.guardId)
  res.json({ success: true })
})

export default router
