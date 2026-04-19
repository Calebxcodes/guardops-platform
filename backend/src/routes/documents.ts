import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query } from '../db/schema'

const router = Router()

// ── Upload directory — /data/uploads on Railway, ./uploads locally ────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || (process.env.NODE_ENV === 'production' ? '/data/uploads' : path.join(__dirname, '../../uploads'))

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ext = path.extname(file.originalname)
    cb(null, `${unique}${ext}`)
  },
})

const CATEGORIES = ['policy', 'training', 'sop', 'compliance', 'general']

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain',
]

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true)
    cb(new Error('File type not allowed'))
  },
})

// GET /api/documents — list all documents
router.get('/', async (req: Request, res: Response) => {
  const { category, site_id } = req.query
  let sql = `
    SELECT d.id, d.name, d.original_name, d.category, d.site_id,
           s.name AS site_name, d.mime_type, d.size, d.description,
           d.is_guard_visible, d.created_at,
           a.name AS uploaded_by_name
    FROM documents d
    LEFT JOIN sites s ON s.id = d.site_id
    LEFT JOIN admin_users a ON a.id = d.uploaded_by
    WHERE 1=1
  `
  const params: any[] = []
  if (category) { params.push(category); sql += ` AND d.category = $${params.length}` }
  if (site_id)  { params.push(site_id);  sql += ` AND d.site_id  = $${params.length}` }
  sql += ' ORDER BY d.created_at DESC'
  const { rows } = await query(sql, params)
  res.json(rows)
})

// POST /api/documents — upload a new document
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const { name, category = 'general', site_id, description, is_guard_visible } = req.body
  const adminId = (req as any).admin?.id ?? null

  if (!CATEGORIES.includes(category)) {
    try { fs.unlinkSync(req.file.path) } catch {}
    return res.status(400).json({ error: 'Invalid category' })
  }

  const docName  = (name || req.file.originalname).toString().slice(0, 200)
  const visible  = is_guard_visible === 'false' || is_guard_visible === '0' ? 0 : 1

  const { rows } = await query(
    `INSERT INTO documents
       (name, original_name, category, site_id, uploaded_by, file_path, mime_type, size, description, is_guard_visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, name, original_name, category, site_id, mime_type, size, description, is_guard_visible, created_at`,
    [
      docName,
      req.file.originalname,
      category,
      site_id || null,
      adminId,
      req.file.path,
      req.file.mimetype,
      req.file.size,
      description || null,
      visible,
    ]
  )
  res.status(201).json(rows[0])
})

// GET /api/documents/:id/download — serve the file
router.get('/:id/download', async (req: Request, res: Response) => {
  const { rows } = await query('SELECT * FROM documents WHERE id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' })
  const doc = rows[0]
  if (!fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'File not found on disk' })
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`)
  res.setHeader('Content-Length', doc.size)
  fs.createReadStream(doc.file_path).pipe(res)
})

// PATCH /api/documents/:id — update only the provided fields
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, category, site_id, description, is_guard_visible } = req.body
  const sets: string[] = []
  const params: any[]  = []

  const add = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`) }

  if (name             !== undefined) add('name',             name || null)
  if (category         !== undefined) add('category',         CATEGORIES.includes(category) ? category : null)
  if (site_id          !== undefined) add('site_id',          site_id || null)
  if (description      !== undefined) add('description',      description || null)
  if (is_guard_visible !== undefined) add('is_guard_visible', is_guard_visible ? 1 : 0)

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })

  params.push(req.params.id)
  const { rows } = await query(
    `UPDATE documents SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, original_name, category, site_id, mime_type, size, description, is_guard_visible, created_at`,
    params
  )
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' })
  res.json(rows[0])
})

// DELETE /api/documents/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await query('DELETE FROM documents WHERE id = $1 RETURNING file_path', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' })
  // Best-effort file deletion — don't error if already gone
  try { fs.unlinkSync(rows[0].file_path) } catch {}
  res.json({ success: true })
})

export default router
