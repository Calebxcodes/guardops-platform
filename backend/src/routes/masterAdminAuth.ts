import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool'

const router = Router()

// ── JWT payload shape ─────────────────────────────────────────────────────────
export interface MasterAdminPayload {
  adminId: number
  role: string
  mfaPending?: boolean
}

declare global {
  namespace Express {
    interface Request {
      masterAdmin?: MasterAdminPayload
    }
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
export function requireMasterAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as MasterAdminPayload
    if (payload.mfaPending) return res.status(401).json({ error: 'MFA required' })
    req.masterAdmin = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const ROLE_LEVELS: Record<string, number> = { super_admin: 3, editor: 2, viewer: 1 }

export function requireRole(role: 'super_admin' | 'editor' | 'viewer') {
  return (req: Request, res: Response, next: NextFunction) => {
    const level = ROLE_LEVELS[req.masterAdmin?.role ?? ''] ?? 0
    if (level < ROLE_LEVELS[role]) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const { rows } = await pool.query(
    'SELECT * FROM public.master_admins WHERE email = $1',
    [email]
  )
  const admin = rows[0]
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })

  const match = await bcrypt.compare(password, admin.password_hash)
  if (!match) return res.status(401).json({ error: 'Invalid credentials' })

  const secret = process.env.JWT_SECRET!
  const token = jwt.sign(
    { adminId: admin.id, role: admin.role } satisfies MasterAdminPayload,
    secret,
    { expiresIn: '24h' }
  )

  res.json({ token, role: admin.role, name: admin.name })
})

router.post('/auth/create-first-admin', async (req: Request, res: Response) => {
  const { name, email, password, bootstrapSecret } = req.body
  if (bootstrapSecret !== process.env.MASTER_BOOTSTRAP_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!name || !email || !password || password.length < 12) {
    return res.status(400).json({ error: 'name, email, and password (min 12 chars) required' })
  }

  const { rows: existing } = await pool.query(
    'SELECT id FROM public.master_admins WHERE email = $1',
    [email]
  )
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' })

  const hash = await bcrypt.hash(password, 12)
  const { rows } = await pool.query(
    `INSERT INTO public.master_admins (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin') RETURNING id, name, email, role`,
    [name, email, hash]
  )
  res.status(201).json(rows[0])
})

router.get('/auth/me', requireMasterAdmin, async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM public.master_admins WHERE id = $1',
    [req.masterAdmin!.adminId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

export default router
