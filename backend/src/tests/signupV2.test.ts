import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../db/pool', () => ({
  pool: {
    query: vi.fn(),
  },
}))

vi.mock('../db/tenantSchema', () => ({
  initTenantSchema: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_pw') },
}))

// Stripe mock
vi.mock('stripe', () => {
  const mock = vi.fn().mockImplementation(() => ({
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
  }))
  return { default: mock }
})

async function buildApp() {
  const { default: router } = await import('../routes/signupV2')
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  return app
}

describe('POST /api/signup', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockReset()
  })

  it('returns 400 when required fields missing', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/signup').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('returns 400 when password too short', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/signup').send({
      companyName: 'Test Co',
      email: 'a@b.com',
      password: 'short',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/10 characters/)
  })

  it('returns 400 for invalid tier', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/signup').send({
      companyName: 'Test Co',
      email: 'a@b.com',
      password: 'validpassword',
      tier: 'ultra',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid tier/)
  })

  it('returns 409 when slug already taken', async () => {
    const { pool } = await import('../db/pool')
    // First call = slug check (returns existing row), rest = never
    ;(pool.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] })
    const app = await buildApp()
    const res = await request(app).post('/api/signup').send({
      companyName: 'Test Co',
      email: 'a@b.com',
      password: 'validpassword',
    })
    expect(res.status).toBe(409)
  })

  it('returns 201 on happy path', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any)
      .mockResolvedValueOnce({ rows: [] })               // slug unique check
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })      // INSERT tenant
      .mockResolvedValueOnce({ rows: [] })               // UPDATE database_name
      .mockResolvedValueOnce({ rows: [] })               // INSERT admin_users
      .mockResolvedValueOnce({ rows: [] })               // INSERT subscriptions
      .mockResolvedValueOnce({ rows: [] })               // INSERT audit_logs

    process.env.STRIPE_SECRET_KEY = ''
    const app = await buildApp()
    const res = await request(app).post('/api/signup').send({
      companyName: 'Acme Security',
      email: 'admin@acme.com',
      password: 'validpassword123',
      tier: 'starter',
    })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('tenantId', 7)
    expect(res.body).toHaveProperty('slug', 'acme-security')
    expect(res.body).toHaveProperty('trialEndsAt')
  })
})
