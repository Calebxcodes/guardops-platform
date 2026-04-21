import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { requireMasterAdmin, requireRole } from './masterAdminAuth'

const router = Router()

// List all master admins
router.get('/users', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM public.master_admins ORDER BY created_at ASC'
  )
  res.json(rows)
})

// Create a new master admin
router.post('/users', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { name, email, password, role = 'viewer' } = req.body
  if (!name || !email || !password || password.length < 12) {
    return res.status(400).json({ error: 'name, email, and password (min 12 chars) required' })
  }
  const validRoles = ['super_admin', 'editor', 'viewer']
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
  }

  const { rows: existing } = await pool.query(
    'SELECT id FROM public.master_admins WHERE email = $1',
    [email]
  )
  if (existing.length > 0) return res.status(409).json({ error: 'Email already registered' })

  const hash = await bcrypt.hash(password, 12)
  const { rows } = await pool.query(
    `INSERT INTO public.master_admins (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
    [name, email, hash, role]
  )

  const now = Math.floor(Date.now() / 1000)
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'master_admin_created', 'master_admin', $2, $3)`,
    [req.masterAdmin!.adminId, rows[0].id, JSON.stringify({ email, role })]
  )

  res.status(201).json(rows[0])
})

// Update role
router.patch('/users/:userId/role', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { userId } = req.params
  const { role } = req.body
  const validRoles = ['super_admin', 'editor', 'viewer']
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
  }
  if (Number(userId) === req.masterAdmin!.adminId) {
    return res.status(400).json({ error: 'Cannot change your own role' })
  }

  const { rows } = await pool.query(
    'UPDATE public.master_admins SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
    [role, userId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })

  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'master_admin_role_changed', 'master_admin', $2, $3)`,
    [req.masterAdmin!.adminId, userId, JSON.stringify({ role })]
  )

  res.json(rows[0])
})

// Delete a master admin
router.delete('/users/:userId', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { userId } = req.params
  if (Number(userId) === req.masterAdmin!.adminId) {
    return res.status(400).json({ error: 'Cannot delete your own account' })
  }

  const { rows } = await pool.query(
    'DELETE FROM public.master_admins WHERE id = $1 RETURNING id, email',
    [userId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'User not found' })

  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'master_admin_deleted', 'master_admin', $2, $3)`,
    [req.masterAdmin!.adminId, userId, JSON.stringify({ email: rows[0].email })]
  )

  res.json({ message: 'User deleted' })
})

// Audit logs — readable by all master admins
router.get('/audit-logs', requireMasterAdmin, async (req: Request, res: Response) => {
  const { action, target_type, tenant_id, limit = 100, offset = 0 } = req.query

  let sql = 'SELECT * FROM public.audit_logs WHERE 1=1'
  const params: any[] = []

  if (action) {
    params.push(action)
    sql += ` AND action = $${params.length}`
  }
  if (target_type) {
    params.push(target_type)
    sql += ` AND target_type = $${params.length}`
  }
  if (tenant_id) {
    params.push(Number(tenant_id))
    sql += ` AND target_id = $${params.length} AND target_type = 'tenant'`
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(Number(limit), Number(offset))

  const { rows } = await pool.query(sql, params)
  res.json(rows)
})

export default router
