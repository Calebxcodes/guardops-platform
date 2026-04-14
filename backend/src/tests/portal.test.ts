import { vi, describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'

// vi.mock is hoisted — use vi.hoisted so mockQuery is available inside the factory
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))

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

vi.mock('../routes/adminAuth', () => {
  const express = require('express')
  const router = express.Router()
  return {
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    ensureDefaultAdmin: vi.fn(),
    default: router,
  }
})

import express from 'express'
import request from 'supertest'
import portalRouter from '../routes/clientPortal'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/portal', portalRouter)
  return app
}

describe('Client Portal — token hashing', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('rejects tokens that are not 64-char hex', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/portal/short-invalid-token')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid portal link/i)
  })

  it('hashes the incoming token before DB lookup', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // Return no rows — token not found
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const app = makeApp()
    await request(app).get(`/api/portal/${rawToken}`)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('WHERE token = $1')
    expect(params[0]).toBe(expectedHash)      // stored hash, NOT the raw token
    expect(params[0]).not.toBe(rawToken)
  })

  it('returns 401 when token is not found in DB', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const app = makeApp()
    const res = await request(app).get(`/api/portal/${rawToken}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid or expired/i)
  })

  it('generate stores hash + prefix and returns raw token once', async () => {
    // client lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'ACME Ltd' }] })
    // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const app = makeApp()
    const res = await request(app)
      .post('/api/portal/generate')
      .send({ client_id: 1, label: 'Test Link' })

    expect(res.status).toBe(200)

    const rawToken: string = res.body.token
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/)   // raw token is 64-char hex

    const insertCall = mockQuery.mock.calls[1]
    const [insertSql, insertParams] = insertCall
    expect(insertSql).toContain('INSERT INTO client_portal_tokens')

    const storedToken: string  = insertParams[1]   // token column (hash)
    const storedPrefix: string = insertParams[2]   // token_prefix column

    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    expect(storedToken).toBe(expectedHash)           // DB stores the hash
    expect(storedToken).not.toBe(rawToken)           // never stores raw token
    expect(storedPrefix).toBe(rawToken.slice(0, 12)) // prefix = first 12 chars
  })

  it('listTokens returns token_prefix but not the raw token or hash', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, client_id: 1, token_prefix: 'abc123def456', label: 'Test', active: 1, created_at: new Date() }],
    })

    const app = makeApp()
    const res = await request(app).get('/api/portal/tokens/1')

    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty('token_prefix')
    expect(res.body[0]).not.toHaveProperty('token')
  })
})
