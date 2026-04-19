import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Shared mocks — all vi.hoisted/vi.mock calls before imports ─────────────

const { mockQuery, multerBody } = vi.hoisted(() => {
  process.env.JWT_SECRET   = 'test-secret-for-vitest-only'
  process.env.DATABASE_URL = 'postgresql://ci:ci@localhost/ci_test'
  // multerBody.value is injected into req.body by the multer mock below,
  // letting each test control what fields multer "parsed" without real multipart I/O.
  return { mockQuery: vi.fn(), multerBody: { value: {} as Record<string, any> } }
})

vi.mock('../db/schema', () => ({
  query: mockQuery,
  pool: {},
  auditLog: vi.fn(),
  PgRateLimitStore: vi.fn().mockImplementation(() => ({
    increment: vi.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: vi.fn(),
    resetKey: vi.fn(),
  })),
}))

// Multer mock — skips disk I/O; injects a fake req.file and req.body fields
vi.mock('multer', () => {
  const multer: any = () => ({
    single: (_field: string) => (req: any, _res: any, next: any) => {
      req.file = {
        originalname: 'fire-safety-policy.pdf',
        mimetype:     'application/pdf',
        path:         '/tmp/test-upload.pdf',
        size:         2048,
      }
      // Real multer populates req.body from multipart fields — replicate that here
      Object.assign(req.body, multerBody.value)
      next()
    },
  })
  multer.diskStorage = () => ({})
  return { default: multer }
})


vi.mock('../routes/adminAuth', () => {
  const express = require('express')
  const router  = express.Router()
  return {
    requireAdmin:       (_req: any, _res: any, next: any) => { (_req as any).admin = { id: 1 }; next() },
    ensureDefaultAdmin: vi.fn(),
    default:            router,
  }
})

import express from 'express'
import request from 'supertest'
import documentsRouter from '../routes/documents'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res: any, next: any) => { req.admin = { id: 1 }; next() })
  app.use('/api/documents', documentsRouter)
  return app
}

describe('Documents API', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    multerBody.value = {}
  })

  // ── GET /api/documents ──────────────────────────────────────────────────

  describe('GET /api/documents', () => {
    it('returns a list of documents', async () => {
      const now = new Date().toISOString()
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Fire Safety Policy', original_name: 'fire.pdf',
          category: 'policy', site_id: null, site_name: null,
          mime_type: 'application/pdf', size: 2048,
          description: null, is_guard_visible: 1, created_at: now, uploaded_by_name: 'Admin',
        }],
      })
      const res = await request(makeApp()).get('/api/documents')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body[0]).toMatchObject({ name: 'Fire Safety Policy', category: 'policy' })
    })

    it('filters by category when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      const res = await request(makeApp()).get('/api/documents?category=training')
      expect(res.status).toBe(200)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('category')
      expect(params).toContain('training')
    })
  })

  // ── POST /api/documents ─────────────────────────────────────────────────

  describe('POST /api/documents', () => {
    it('creates a document record and returns 201', async () => {
      multerBody.value = { name: 'Fire Safety Policy', category: 'policy' }
      const now = new Date().toISOString()
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 42, name: 'Fire Safety Policy', original_name: 'fire-safety-policy.pdf',
          category: 'policy', site_id: null, mime_type: 'application/pdf',
          size: 2048, description: null, is_guard_visible: 1, created_at: now,
        }],
      })
      const res = await request(makeApp()).post('/api/documents')
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ id: 42, category: 'policy' })
    })

    it('rejects an invalid category', async () => {
      multerBody.value = { name: 'Doc', category: 'invalid-cat' }
      const res = await request(makeApp()).post('/api/documents')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/invalid category/i)
      // No DB query should have been made
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  // ── DELETE /api/documents/:id ───────────────────────────────────────────

  describe('DELETE /api/documents/:id', () => {
    it('deletes the record and returns success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ file_path: '/tmp/test.pdf' }] })
      const res = await request(makeApp()).delete('/api/documents/1')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 404 when document does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      const res = await request(makeApp()).delete('/api/documents/999')
      expect(res.status).toBe(404)
    })
  })

  // ── PATCH /api/documents/:id ────────────────────────────────────────────

  describe('PATCH /api/documents/:id', () => {
    it('updates only the provided fields', async () => {
      const now = new Date().toISOString()
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Updated Name', category: 'training', site_id: null,
          mime_type: 'application/pdf', size: 1024,
          description: null, is_guard_visible: 0, created_at: now,
        }],
      })
      const res = await request(makeApp())
        .patch('/api/documents/1')
        .send({ name: 'Updated Name', is_guard_visible: false })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated Name')

      const [sql] = mockQuery.mock.calls[0]
      // Only sent fields should appear in the SET clause
      expect(sql).toContain('name =')
      expect(sql).toContain('is_guard_visible =')
      expect(sql).not.toContain('site_id =')
    })

    it('returns 400 when no fields are provided', async () => {
      const res = await request(makeApp()).patch('/api/documents/1').send({})
      expect(res.status).toBe(400)
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
