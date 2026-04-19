import { Router, Request, Response } from 'express'
import fs from 'fs'
import { query } from '../db/schema'

const router = Router()

// GET /api/guard/documents — list documents visible to the guard
// Returns global docs (no site_id) + docs for the guard's current/upcoming site
router.get('/', async (req: Request, res: Response) => {
  const guardId = (req as any).guard?.guardId

  // Find the guard's active/today shift site
  const { rows: shiftRows } = await query(
    `SELECT DISTINCT s.id
     FROM shifts sh
     JOIN sites s ON s.id = sh.site_id
     WHERE sh.guard_id = $1
       AND DATE(sh.start_time) = CURRENT_DATE`,
    [guardId]
  )
  const siteIds = shiftRows.map((r: any) => r.id)

  let sql = `
    SELECT d.id, d.name, d.original_name, d.category, d.site_id,
           s.name AS site_name, d.mime_type, d.size, d.description, d.created_at
    FROM documents d
    LEFT JOIN sites s ON s.id = d.site_id
    WHERE d.is_guard_visible = 1
      AND (d.site_id IS NULL`
  const params: any[] = []

  if (siteIds.length > 0) {
    params.push(siteIds)
    sql += ` OR d.site_id = ANY($${params.length})`
  }
  sql += ') ORDER BY d.category, d.created_at DESC'

  const { rows } = await query(sql, params)
  res.json(rows)
})

// GET /api/guard/documents/:id/download — serve a guard-visible document
router.get('/:id/download', async (req: Request, res: Response) => {
  const { rows } = await query(
    'SELECT * FROM documents WHERE id = $1 AND is_guard_visible = 1',
    [req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Document not found' })
  const doc = rows[0]
  if (!fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'File not found on disk' })
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`)
  res.setHeader('Content-Length', doc.size)
  fs.createReadStream(doc.file_path).pipe(res)
})

export default router
