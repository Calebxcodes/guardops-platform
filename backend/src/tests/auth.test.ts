import { vi, describe, it, expect, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const { mockQuery } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-vitest-only'
  return { mockQuery: vi.fn() }
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

// Stub sendPasswordReset so nodemailer is never imported
vi.mock('../services/email', () => ({
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
}))

import express from 'express'
import request from 'supertest'
import adminAuthRouter from '../routes/adminAuth'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin/auth', adminAuthRouter)
  return app
}

describe('Admin auth — login endpoint contract', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('returns { token, admin } on valid credentials', async () => {
    const password = 'correcthorsebatterystaple'
    const hash = await bcrypt.hash(password, 10)

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Test Admin', email: 'admin@test.com', password_hash: hash }],
    })
    mockQuery.mockResolvedValue({ rows: [] })  // for auditLog INSERT

    const app = makeApp()
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@test.com', password })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('admin')
    expect(res.body.admin).toMatchObject({ id: 1, name: 'Test Admin', email: 'admin@test.com' })
    expect(res.body.admin).not.toHaveProperty('password_hash')
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(0)
  })

  it('returns 401 on wrong password', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Test Admin', email: 'admin@test.com', password_hash: hash }],
    })
    mockQuery.mockResolvedValue({ rows: [] })

    const app = makeApp()
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 401 when email not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    mockQuery.mockResolvedValue({ rows: [] })

    const app = makeApp()
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody@test.com', password: 'whatever' })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const app = makeApp()
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({})

    expect(res.status).toBe(400)
  })
})
