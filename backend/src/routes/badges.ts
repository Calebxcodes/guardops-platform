import { Router, Request, Response } from 'express'
import multer from 'multer'
import { query } from '../db/pool'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireAdmin } from './adminAuth'
import { extractBadgeData, isBadgeExpired } from '../services/badgeOcrService'
import { uploadToS3 } from '../services/s3Service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// ── Guard-facing routes ───────────────────────────────────────────────────────
// Mounted at /api/guard/badges

// POST /upload — upload badge photo, run OCR, return extracted data for review
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const [photoUrl, extracted] = await Promise.all([
      uploadToS3(req.file.buffer, req.file.mimetype, 'badges'),
      extractBadgeData(req.file.buffer),
    ])
    res.json({ extracted, photo_url: photoUrl })
  } catch (err: any) {
    console.error('[badges/upload]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /confirm — guard confirms extracted data, save to DB (blocks expired badges)
router.post('/confirm', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })

  const { sia_license_number, sia_expiry_date, badge_number, card_type, photo_url } = req.body
  if (!sia_expiry_date) return res.status(400).json({ error: 'sia_expiry_date is required' })

  if (isBadgeExpired(sia_expiry_date)) {
    return res.status(400).json({
      error: 'Badge is expired. Expired badges cannot be saved.',
      expired_date: sia_expiry_date,
    })
  }

  try {
    await query(
      `UPDATE security_badges SET is_current = 0, archived_at = NOW() WHERE guard_id = $1 AND is_current = 1`,
      [req.guardId]
    )
    const { rows } = await query(
      `INSERT INTO security_badges
         (guard_id, sia_license_number, sia_expiry_date, badge_number, card_type, photo_url, is_current, status, reviewed_by_guard_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 'verified', $7)
       RETURNING id`,
      [req.guardId, sia_license_number || null, sia_expiry_date, badge_number || null, card_type || null, photo_url || null, Date.now()]
    )
    res.status(201).json({ success: true, badge_id: rows[0].id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /current — guard's current badge + history
router.get('/current', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  try {
    const { rows } = await query(
      `SELECT * FROM security_badges WHERE guard_id = $1 ORDER BY created_at DESC`,
      [req.guardId]
    )
    res.json({
      current: rows.find(r => r.is_current === 1) || null,
      history: rows,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Admin-facing routes ───────────────────────────────────────────────────────
// Mounted at /api/badges

// GET /admin/guards — all guards with their current badge status
router.get('/admin/guards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT
        g.id, g.first_name, g.last_name, g.email, g.status,
        b.id        AS badge_id,
        b.sia_license_number,
        b.sia_expiry_date,
        b.badge_number,
        b.card_type,
        b.photo_url,
        b.status    AS badge_status,
        b.created_at AS badge_uploaded_at
      FROM guards g
      LEFT JOIN security_badges b ON b.guard_id = g.id AND b.is_current = 1
      WHERE g.active = 1 AND g.deleted_at IS NULL
      ORDER BY g.first_name, g.last_name
    `)
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /admin/guards/:guardId — specific guard's badge + full history
router.get('/admin/guards/:guardId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const guardId = parseInt(req.params.guardId)
    const { rows } = await query(
      `SELECT * FROM security_badges WHERE guard_id = $1 ORDER BY created_at DESC`,
      [guardId]
    )
    res.json({
      current: rows.find(r => r.is_current === 1) || null,
      history: rows,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
