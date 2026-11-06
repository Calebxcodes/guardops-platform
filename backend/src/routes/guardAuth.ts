import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { pool, query } from '../db/pool'
import { sendGuardWelcomeEmail } from '../services/email'
import crypto from 'crypto'
import multer from 'multer'
import { extractBadgeData } from '../services/badgeOcrService'
import { uploadToS3, signedUrl, canonicalUrl } from '../services/s3Service'

const router = Router()
const badgeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/**
 * GET /api/tenants/public
 * Returns all active tenants (id, name, slug) for the company selection page.
 * Fix #7 — Multi-tenant guard signup.
 */
router.get('/tenants/public', async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, name, slug FROM public.tenants
     WHERE status NOT IN ('deleted','archived')
     ORDER BY name ASC`
  )
  res.json({ success: true, tenants: rows })
})

/**
 * POST /api/guard/signup/badge
 * Badge photo + OCR during signup, before the guard has an account (the
 * authenticated /guard/badges/upload can't be used yet). Images only, rate limited.
 */
router.post('/guard/signup/badge', badgeUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Badge must be a photo' })
  const { rows } = await pool.query(
    "SELECT id FROM public.tenants WHERE id = $1 AND status NOT IN ('deleted','archived')",
    [Number(req.body.tenantId) || 0]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Company not found' })

  try {
    const [photoUrl, extracted] = await Promise.all([
      uploadToS3(req.file.buffer, req.file.mimetype, 'badges'),
      extractBadgeData(req.file.buffer),
    ])
    res.json({ extracted, photo_url: await signedUrl(photoUrl) })
  } catch (err: any) {
    console.error('[guard/signup/badge]', err.message)
    res.status(500).json({ error: 'Upload failed. Please try again.' })
  }
})

/**
 * POST /api/guard/signup
 * Guard self-signup. Accepts tenantId in the body (resolved from subdomain slug).
 * Creates guard with status='pending'; admin must activate before login is allowed.
 * Fix #7 + Fix #8.
 */
router.post('/guard/signup', async (req: Request, res: Response) => {
  const {
    tenantId, email, password, firstName, lastName,
    phone, dateOfBirth, address,
    siaBadge,
  } = req.body

  if (!tenantId || !email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'tenantId, email, password, firstName and lastName are required' })
  }
  if (password.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters' })
  }

  const tid = Number(tenantId)

  // Verify tenant exists
  const { rows: tenantRows } = await pool.query(
    "SELECT id, name, email, slug FROM public.tenants WHERE id = $1 AND status NOT IN ('deleted','archived')",
    [tid]
  )
  if (!tenantRows[0]) return res.status(404).json({ error: 'Company not found' })

  // Check email not already registered in this tenant
  const { rows: existing } = await query(
    'SELECT id FROM guards WHERE email = $1',
    [email],
    tid
  )
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email already registered at this company' })
  }

  // Check guard_links (can't sign up for two tenants with same email)
  const { rows: linkRows } = await pool.query(
    'SELECT id FROM public.guard_links WHERE guard_email = $1 AND tenant_id = $2',
    [email, tid]
  )
  if (linkRows.length > 0) {
    return res.status(409).json({ error: 'Email already registered at this company' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const tenant = tenantRows[0]

  // Create guard with status='pending'
  const certifications = siaBadge
    ? JSON.stringify([{
        name: 'SIA Licence',
        licence_number: siaBadge.sia_license_number || '',
        expiry: siaBadge.sia_expiry_date || '',
      }])
    : '[]'

  const { rows: guardRows } = await query(
    `INSERT INTO guards (first_name, last_name, email, phone, address, date_of_birth, status, active, certifications, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', 1, $7, NOW())
     RETURNING id`,
    [firstName, lastName, email, phone || null, address || null, dateOfBirth || null, certifications],
    tid
  )
  const guardId = guardRows[0].id

  // Badge scanned during signup becomes the guard's current badge
  if (siaBadge?.sia_expiry_date) {
    await query(
      `INSERT INTO security_badges (guard_id, sia_license_number, sia_expiry_date, badge_number, card_type, photo_url, is_current, reviewed_by_guard_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
      [guardId, siaBadge.sia_license_number || null, siaBadge.sia_expiry_date, siaBadge.badge_number || null,
       siaBadge.card_type || null, canonicalUrl(siaBadge.photo_url), Date.now()],
      tid
    )
  }

  // Create guard_auth
  await query(
    'INSERT INTO guard_auth (guard_id, password_hash) VALUES ($1, $2)',
    [guardId, passwordHash],
    tid
  )

  // Register in guard_links for cross-tenant login
  await pool.query(
    `INSERT INTO public.guard_links (guard_email, tenant_id, guard_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (guard_email, tenant_id) DO UPDATE SET guard_id = EXCLUDED.guard_id`,
    [email, tid, guardId]
  )

  // Send welcome email to guard
  try {
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenHash  = crypto.createHash('sha256').update(resetToken).digest('hex')
    const expiresAt  = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await pool.query(
      `INSERT INTO password_reset_tokens (user_type, user_id, tenant_id, token, expires_at) VALUES ('guard', $1, $2, $3, $4)`,
      [guardId, tid, tokenHash, expiresAt.toISOString()]
    )
    await sendGuardWelcomeEmail(email, firstName, tenant.name, resetToken, tenant.slug)
  } catch { /* email not critical */ }

  // Notify admin via email
  try {
    const { Resend } = await import('resend')
    const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    if (resendClient && tenant.email) {
      const guardAppUrl = process.env.GUARD_APP_URL || 'https://guard.strondis.com'
      const adminUrl = tenant.slug ? `https://${tenant.slug}.strondis.com` : (process.env.FRONTEND_URL || 'https://app.strondis.com')
      await resendClient.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@strondis.com',
        to: tenant.email,
        subject: `New guard signup: ${firstName} ${lastName}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2>New Guard Signup</h2>
          <p><strong>${firstName} ${lastName}</strong> (${email}) has signed up and is awaiting activation.</p>
          <a href="${adminUrl}/guards" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Review in Dashboard →</a>
        </div>`,
      })
    }
  } catch { /* email not critical */ }

  res.status(201).json({
    success: true,
    message: 'Signup complete. Your account is pending admin activation.',
  })
})

export default router
