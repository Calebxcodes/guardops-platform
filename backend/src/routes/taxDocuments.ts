import { Router, Request, Response } from 'express'
import multer from 'multer'
import { query } from '../db/pool'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireAdmin } from './adminAuth'
import { uploadToS3 } from '../services/s3Service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const ALLOWED_TYPES = ['P11D', 'P9D', 'P45', 'P60', 'HMRC Letter', 'Other']

// ── Guard-facing routes ───────────────────────────────────────────────────────
// Mounted at /api/guard/tax-docs

// POST /upload — upload a tax document to S3 and record it
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const { document_type } = req.body
  if (!document_type) return res.status(400).json({ error: 'document_type is required' })

  try {
    const fileUrl = await uploadToS3(req.file.buffer, req.file.mimetype, 'tax-docs')
    const { rows } = await query(
      `INSERT INTO tax_documents (guard_id, document_type, file_name, file_url, uploaded_by)
       VALUES ($1, $2, $3, $4, 'guard') RETURNING id`,
      [req.guardId, document_type, req.file.originalname, fileUrl]
    )
    res.status(201).json({ success: true, id: rows[0].id, file_url: fileUrl, file_name: req.file.originalname })
  } catch (err: any) {
    console.error('[tax-docs/upload]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET / — guard's own documents
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  try {
    const { rows } = await query(
      `SELECT id, document_type, file_name, file_url, uploaded_by, created_at
       FROM tax_documents WHERE guard_id = $1 ORDER BY created_at DESC`,
      [req.guardId]
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /:id — delete own document
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  try {
    const { rowCount } = await query(
      `DELETE FROM tax_documents WHERE id = $1 AND guard_id = $2`,
      [parseInt(req.params.id), req.guardId]
    )
    if (!rowCount) return res.status(404).json({ error: 'Document not found or not yours' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Admin-facing routes ───────────────────────────────────────────────────────
// Mounted at /api/tax-docs

// GET /admin/guards/:guardId — admin views a guard's tax documents
router.get('/admin/guards/:guardId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, document_type, file_name, file_url, uploaded_by, created_at
       FROM tax_documents WHERE guard_id = $1 ORDER BY created_at DESC`,
      [parseInt(req.params.guardId)]
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
