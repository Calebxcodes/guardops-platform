import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_secret_key_for_vitest'

vi.mock('../db/pool', () => ({
  pool: { query: vi.fn() },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}))

async function buildApp() {
  const { default: router } = await import('../routes/masterAdminAuth')
  const app = express()
  app.use(express.json())
  app.use('/api/master-admin', router)
  return app
}

describe('POST /api/master-admin/auth/login', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.JWT_SECRET = TEST_SECRET
  })

  it('returns 400 when missing fields', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/master-admin/auth/login').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
  })

  it('returns 401 for unknown email', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockResolvedValueOnce({ rows: [] })
    const app = await buildApp()
    const res = await request(app)
      .post('/api/master-admin/auth/login')
      .send({ email: 'x@y.com', password: 'pw' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@strondis.com', password_hash: 'hash', role: 'super_admin' }],
    })
    const bcrypt = await import('bcryptjs')
    ;(bcrypt.default.compare as any).mockResolvedValueOnce(false)
    const app = await buildApp()
    const res = await request(app)
      .post('/api/master-admin/auth/login')
      .send({ email: 'admin@strondis.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('returns token on valid credentials', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Admin', email: 'admin@strondis.com', password_hash: 'hash', role: 'super_admin' }],
    })
    const bcrypt = await import('bcryptjs')
    ;(bcrypt.default.compare as any).mockResolvedValueOnce(true)
    const app = await buildApp()
    const res = await request(app)
      .post('/api/master-admin/auth/login')
      .send({ email: 'admin@strondis.com', password: 'correct' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    const payload = jwt.verify(res.body.token, TEST_SECRET) as any
    expect(payload.adminId).toBe(1)
    expect(payload.role).toBe('super_admin')
  })
})

describe('requireMasterAdmin middleware', () => {
  it('blocks requests without Authorization header', async () => {
    const { requireMasterAdmin } = await import('../routes/masterAdminAuth')
    const app = express()
    app.get('/protected', requireMasterAdmin, (_req, res) => res.json({ ok: true }))
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
  })

  it('blocks requests with expired token', async () => {
    const { requireMasterAdmin } = await import('../routes/masterAdminAuth')
    const expiredToken = jwt.sign({ adminId: 1, role: 'super_admin' }, TEST_SECRET, { expiresIn: -1 })
    const app = express()
    app.get('/protected', requireMasterAdmin, (_req, res) => res.json({ ok: true }))
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expiredToken}`)
    expect(res.status).toBe(401)
  })

  it('passes valid token through', async () => {
    const { requireMasterAdmin } = await import('../routes/masterAdminAuth')
    const token = jwt.sign({ adminId: 1, role: 'super_admin' }, TEST_SECRET, { expiresIn: '1h' })
    const app = express()
    app.get('/protected', requireMasterAdmin, (_req, res) => res.json({ ok: true }))
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
