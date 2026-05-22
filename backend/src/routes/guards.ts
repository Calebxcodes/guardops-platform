import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import * as Sentry from '@sentry/node'
import { query, pool } from '../db/pool'
import { requirePermission } from '../middleware/rbac'
import { sendGuardWelcomeEmail } from '../services/email'

const router = Router()

const tid = (req: Request): number => (req as any).tenantId as number
const adminId = (req: Request): number => (req as any).adminId as number

// ── Active guards ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT g.*,
         (SELECT COUNT(*) FROM shifts WHERE guard_id = g.id AND status = 'active')::int AS active_shifts
       FROM guards g
       WHERE g.active = 1 AND g.deleted_at IS NULL
       ORDER BY g.last_name, g.first_name`,
      [],
      tid(req)
    )
    res.json(rows.map((g: any) => ({
      ...g,
      certifications: JSON.parse(g.certifications || '[]'),
      skills: JSON.parse(g.skills || '[]'),
    })))
  } catch (err: any) {
    console.error('[guards GET /]', err)
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Deleted guards list (must be before /:id) ─────────────────────────────────

router.get('/deleted', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, phone, status, employment_type, deleted_at
       FROM guards
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [],
      tid(req)
    )
    res.json({ success: true, guards: rows })
  } catch (err: any) {
    console.error('[guards GET /deleted]', err)
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Single guard ──────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT * FROM guards WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
      tid(req)
    )
    const guard = rows[0]
    if (!guard) return res.status(404).json({ error: 'Guard not found' })
    res.json({
      ...guard,
      certifications: JSON.parse(guard.certifications || '[]'),
      skills: JSON.parse(guard.skills || '[]'),
    })
  } catch (err: any) {
    console.error('[guards GET /:id]', err)
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Create guard ──────────────────────────────────────────────────────────────

router.post('/', requirePermission('guards', 'create'), async (req: Request, res: Response) => {
  const {
    first_name, last_name, email, phone, address, date_of_birth,
    employment_type, hourly_rate, certifications, skills,
    bank_account, bank_routing, notes,
  } = req.body

  if (!first_name?.trim()) return res.status(400).json({ error: 'First name is required' })
  if (!last_name?.trim())  return res.status(400).json({ error: 'Last name is required' })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' })

  try {
    const { rows } = await query(
      `INSERT INTO guards
         (first_name, last_name, email, phone, address, date_of_birth,
          employment_type, hourly_rate, certifications, skills, bank_account, bank_routing, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        first_name, last_name, email, phone, address, date_of_birth,
        employment_type || 'full-time', hourly_rate || 15,
        JSON.stringify(certifications || []), JSON.stringify(skills || []),
        bank_account, bank_routing, notes,
      ],
      tid(req)
    )
    const guard = rows[0]

    // Link guard email → tenant for cross-schema login
    if (email) {
      await pool.query(
        `INSERT INTO public.guard_links (guard_email, tenant_id, guard_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (guard_email, tenant_id) DO UPDATE SET guard_id = EXCLUDED.guard_id`,
        [email, tid(req), guard.id]
      )

      // Send welcome email with password-set link
      try {
        const rawToken   = crypto.randomBytes(32).toString('hex')
        const tokenHash  = crypto.createHash('sha256').update(rawToken).digest('hex')
        const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        await query(
          `INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at)
           VALUES ('guard', $1, $2, $3)`,
          [guard.id, tokenHash, expiresAt.toISOString()],
          tid(req)
        )

        // Fetch tenant slug for branded URL
        const { rows: tenantRows } = await pool.query(
          'SELECT slug, name FROM public.tenants WHERE id = $1',
          [tid(req)]
        )
        const tenantSlug = tenantRows[0]?.slug
        const tenantName = tenantRows[0]?.name || 'Your Company'

        await sendGuardWelcomeEmail(
          email,
          `${first_name} ${last_name}`,
          tenantName,
          rawToken,
          tenantSlug
        )
      } catch (emailErr) {
        console.error('[guards POST] Welcome email failed (non-fatal):', emailErr)
      }
    }

    res.status(201).json({
      ...guard,
      certifications: JSON.parse(guard.certifications),
      skills: JSON.parse(guard.skills),
    })
  } catch (err: any) {
    console.error('[guards POST /]', err)
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Update guard ──────────────────────────────────────────────────────────────

router.put('/:id', requirePermission('guards', 'update'), async (req: Request, res: Response) => {
  const {
    first_name, last_name, email, phone, address, date_of_birth,
    employment_type, status, hourly_rate, certifications, skills,
    bank_account, bank_routing, notes,
  } = req.body

  try {
    await query(
      `UPDATE guards
       SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, date_of_birth=$6,
           employment_type=$7, status=$8, hourly_rate=$9, certifications=$10,
           skills=$11, bank_account=$12, bank_routing=$13, notes=$14
       WHERE id=$15 AND deleted_at IS NULL`,
      [
        first_name, last_name, email, phone, address, date_of_birth,
        employment_type, status, hourly_rate,
        JSON.stringify(certifications || []), JSON.stringify(skills || []),
        bank_account, bank_routing, notes, req.params.id,
      ],
      tid(req)
    )
    const { rows } = await query(
      'SELECT * FROM guards WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
      tid(req)
    )
    const guard = rows[0]
    if (!guard) return res.status(404).json({ error: 'Guard not found' })

    // Keep guard_links in sync if email changed
    if (email) {
      await pool.query(
        `INSERT INTO public.guard_links (guard_email, tenant_id, guard_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (guard_email, tenant_id) DO UPDATE SET guard_id = EXCLUDED.guard_id`,
        [email, tid(req), guard.id]
      )
    }

    res.json({
      ...guard,
      certifications: JSON.parse(guard.certifications),
      skills: JSON.parse(guard.skills),
    })
  } catch (err: any) {
    console.error('[guards PUT /:id]', err)
    Sentry.captureException(err)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── Soft-delete guard ─────────────────────────────────────────────────────────
// Sets deleted_at; leaves all shift/payroll/incident records intact.
// Requires admin password confirmation — this action is tracked in the audit log.

router.delete('/:id', requirePermission('guards', 'delete'), async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string }
  const guardId = Number(req.params.id)

  try {
    // 1. Verify guard exists
    const { rows: guardRows } = await query(
      'SELECT id, first_name, last_name, deleted_at FROM guards WHERE id = $1',
      [guardId],
      tid(req)
    )
    if (!guardRows[0]) {
      return res.status(404).json({ success: false, message: 'Guard not found' })
    }
    if (guardRows[0].deleted_at) {
      return res.status(400).json({ success: false, message: 'This guard is already deleted' })
    }

    // 2. Verify admin password
    const { rows: adminRows } = await query(
      'SELECT password_hash FROM admin_users WHERE id = $1',
      [adminId(req)],
      tid(req)
    )
    const hash = adminRows[0]?.password_hash
    const valid = hash ? await bcrypt.compare(password ?? '', hash) : false
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Incorrect password' })
    }

    // 3. Soft delete — shift history, payroll, and incidents are retained
    await query(
      'UPDATE guards SET deleted_at = NOW() WHERE id = $1',
      [guardId],
      tid(req)
    )

    // 4. Remove guard_links entry so deleted guard cannot log in
    const { rows: emailRows } = await query('SELECT email FROM guards WHERE id = $1', [guardId], tid(req))
    if (emailRows[0]?.email) {
      await pool.query(
        'DELETE FROM public.guard_links WHERE guard_email = $1 AND tenant_id = $2',
        [emailRows[0].email, tid(req)]
      )
    }

    // 5. Audit log
    await query(
      `INSERT INTO audit_log
         (user_type, user_id, action, resource_type, resource_id, ip_address)
       VALUES ('admin', $1, 'GUARD_PROFILE_DELETED', 'guard', $2, $3)`,
      [adminId(req), guardId, req.ip ?? null],
      tid(req)
    )

    return res.json({
      success: true,
      message: 'Guard profile deleted. Shift history retained for compliance.',
    })
  } catch (err: any) {
    console.error('[guards DELETE /:id]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message })
  }
})

// ── Suspend guard (set status = inactive) ─────────────────────────────────────

router.patch('/:id/suspend', requirePermission('guards', 'suspend'), async (req: Request, res: Response) => {
  const guardId = Number(req.params.id)
  try {
    const { rows } = await query(
      'SELECT id, deleted_at FROM guards WHERE id = $1',
      [guardId],
      tid(req)
    )
    if (!rows[0] || rows[0].deleted_at)
      return res.status(404).json({ success: false, message: 'Guard not found' })

    await query(
      "UPDATE guards SET status = 'inactive' WHERE id = $1",
      [guardId],
      tid(req)
    )

    await query(
      `INSERT INTO audit_log
         (user_type, user_id, action, resource_type, resource_id, ip_address)
       VALUES ('admin', $1, 'GUARD_SUSPENDED', 'guard', $2, $3)`,
      [adminId(req), guardId, req.ip ?? null],
      tid(req)
    )

    return res.json({ success: true, message: 'Guard suspended' })
  } catch (err: any) {
    console.error('[guards PATCH /:id/suspend]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message })
  }
})

// ── Restore deleted guard ─────────────────────────────────────────────────────

router.post('/:id/restore', async (req: Request, res: Response) => {
  const guardId = Number(req.params.id)

  try {
    const { rows } = await query(
      'SELECT id, deleted_at FROM guards WHERE id = $1',
      [guardId],
      tid(req)
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Guard not found' })
    }
    if (!rows[0].deleted_at) {
      return res.status(400).json({ success: false, message: 'Guard is not deleted' })
    }

    await query(
      'UPDATE guards SET deleted_at = NULL WHERE id = $1',
      [guardId],
      tid(req)
    )

    // Re-create guard_links entry so guard can log in again
    const { rows: emailRows } = await query('SELECT email FROM guards WHERE id = $1', [guardId], tid(req))
    if (emailRows[0]?.email) {
      await pool.query(
        `INSERT INTO public.guard_links (guard_email, tenant_id, guard_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (guard_email, tenant_id) DO UPDATE SET guard_id = EXCLUDED.guard_id`,
        [emailRows[0].email, tid(req), guardId]
      )
    }

    await query(
      `INSERT INTO audit_log
         (user_type, user_id, action, resource_type, resource_id, ip_address)
       VALUES ('admin', $1, 'GUARD_PROFILE_RESTORED', 'guard', $2, $3)`,
      [adminId(req), guardId, req.ip ?? null],
      tid(req)
    )

    return res.json({ success: true, message: 'Guard profile restored.' })
  } catch (err: any) {
    console.error('[guards POST /:id/restore]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message })
  }
})

export default router
