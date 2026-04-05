import 'dotenv/config'
import 'express-async-errors'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { initSchema, query } from './db/schema'
import { seed } from './db/seed'
import guardsRouter from './routes/guards'
import clientsRouter from './routes/clients'
import sitesRouter from './routes/sites'
import shiftsRouter from './routes/shifts'
import timesheetsRouter from './routes/timesheets'
import payrollRouter from './routes/payroll'
import dashboardRouter from './routes/dashboard'
import incidentsRouter from './routes/incidents'
import authRouter from './routes/auth'
import guardShiftsRouter from './routes/guardShifts'
import guardTimesheetsRouter from './routes/guardTimesheets'
import guardMessagesRouter from './routes/guardMessages'
import guardProfileRouter from './routes/guardProfile'
import adminAuthRouter, { ensureDefaultAdmin } from './routes/adminAuth'
import complianceRouter from './routes/compliance'
import aiReportRouter from './routes/aiReport'
import clientPortalRouter from './routes/clientPortal'

const app = express()
const PORT = process.env.PORT || 3001

// Trust Railway / Vercel reverse proxy so rate-limiter sees real client IPs
app.set('trust proxy', 1)

// ── CORS ──────────────────────────────────────────────────────────────────
const explicitOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? []

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)                        // server-to-server / Postman
    if (origin.includes('localhost')) return callback(null, true)   // local dev
    if (origin.endsWith('.vercel.app')) return callback(null, true) // all Vercel previews + prod
    if (explicitOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))

// ── Rate limiting on auth endpoints ──────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
})
app.use('/api/auth/login', authLimiter)
app.use('/api/admin/auth/login', authLimiter)

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/admin/auth', adminAuthRouter)
app.use('/api/guards', guardsRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/sites', sitesRouter)
app.use('/api/shifts', shiftsRouter)
app.use('/api/timesheets', timesheetsRouter)
app.use('/api/payroll', payrollRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/incidents', incidentsRouter)
app.use('/api/compliance', complianceRouter)
app.use('/api/ai', aiReportRouter)
app.use('/api/portal', clientPortalRouter)
app.use('/api/auth', authRouter)
app.use('/api/guard/shifts', guardShiftsRouter)
app.use('/api/guard/timesheets', guardTimesheetsRouter)
app.use('/api/guard/messages', guardMessagesRouter)
app.use('/api/guard/profile', guardProfileRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Global error handler (catches all async throws via express-async-errors) ──
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${req.method} ${req.path}]`, err.message ?? err)
  if (res.headersSent) return
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' })
})

// ── Startup ───────────────────────────────────────────────────────────────
async function start() {
  await initSchema()
  console.log('Database schema ready.')

  // One-time fix: overnight shifts stored with same-date end_time (SQLite migration artefact)
  const { rowCount } = await query(`
    UPDATE shifts
    SET end_time = end_time + INTERVAL '1 day'
    WHERE EXTRACT(EPOCH FROM (end_time - start_time)) < 0
  `)
  if (rowCount && rowCount > 0) console.log(`Fixed ${rowCount} overnight shift(s).`)

  // Auto-seed if DB is empty (first deploy)
  const { rows } = await query('SELECT COUNT(*)::int as c FROM guards')
  if (rows[0].c === 0) {
    console.log('Empty DB detected — running seed...')
    try { await seed(); console.log('Seed complete.') }
    catch (e) { console.error('Seed failed:', e) }
  }

  await ensureDefaultAdmin()

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`GuardOps API running on port ${PORT}`)
  })
}

start().catch(e => { console.error('Failed to start:', e); process.exit(1) })
