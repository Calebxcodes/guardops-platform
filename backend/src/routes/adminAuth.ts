import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/schema'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'secureedge-admin-secret-change-in-prod'

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

// Seed default admin if none exists
export function ensureDefaultAdmin() {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as any).c
  if (count === 0) {
    const hash = bcrypt.hashSync('admin123', 10)
    db.prepare('INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)')
      .run('SecureEdge Admin', 'admin@secureedge.co.uk', hash)
    console.log('Default admin created: admin@secureedge.co.uk / admin123')
  }
}

router.post('/login', async (req: Request, res: Response) => {
  const db = getDb()
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email) as any
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
  const token = signAdminToken(admin.id, admin.email)
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } })
})

router.get('/me', requireAdmin, (req: any, res: Response) => {
  const db = getDb()
  const admin = db.prepare('SELECT id, name, email, created_at FROM admin_users WHERE id = ?').get(req.adminId)
  res.json(admin)
})

export default router
