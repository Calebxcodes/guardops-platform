import 'dotenv/config'
import 'express-async-errors'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'
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
import { runDailyAlerts } from './services/alerts'
import complianceRouter from './routes/compliance'
import aiReportRouter from './routes/aiReport'
import clientPortalRouter from './routes/clientPortal'

const app = express()
const PORT = process.env.PORT || 3001
const IS_PROD = process.env.NODE_ENV === 'production'

// Trust Railway / Vercel reverse proxy so rate-limiter sees real client IPs
app.set('trust proxy', 1)

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // allow Vercel preview embeds
  contentSecurityPolicy: false,     // APIs don't serve HTML; skip CSP
}))

// ── CORS ──────────────────────────────────────────────────────────────────
// Explicit allowlist — never allow all of *.vercel.app in production
const explicitOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? []
const KNOWN_VERCEL_ORIGINS = [
  'https://frontend-calebxcodes-projects.vercel.app',
  'https://guard-app-ten.vercel.app',
  'https://landing-six-dun-91.vercel.app',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)                              // server-to-server / Postman
    if (!IS_PROD && origin.includes('localhost')) return callback(null, true) // local dev only
    if (KNOWN_VERCEL_ORIGINS.includes(origin)) return callback(null, true)
    if (explicitOrigins.includes(origin)) return callback(null, true)
    callback(null, false)
  },
  credentials: true,
}))

// Reduce body limit — face descriptors are ~1 KB, normal requests much less
app.use(express.json({ limit: '512kb' }))

// ── Rate limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
})
// Stricter limit for password reset — prevents token enumeration & email flooding
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests — please try again in an hour' },
})
app.use('/api/auth/login',              authLimiter)
app.use('/api/admin/auth/login',        authLimiter)
app.use('/api/auth/forgot-password',    resetLimiter)
app.use('/api/auth/reset-password',     resetLimiter)
app.use('/api/admin/auth/forgot-password', resetLimiter)
app.use('/api/admin/auth/reset-password',  resetLimiter)

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
  const status = err.status ?? 500
  console.error(`[${req.method} ${req.path}] ${status}`, err.message ?? err)
  if (res.headersSent) return
  // In production, never forward raw error messages — they can leak schema/query details
  const message = IS_PROD && status === 500
    ? 'An unexpected error occurred. Please try again.'
    : (err.message ?? 'Internal server error')
  res.status(status).json({ error: message })
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

  // Daily alert cron — runs every day at 08:00 server time
  cron.schedule('0 8 * * *', () => {
    runDailyAlerts().catch(e => console.error('[Alerts] cron error:', e))
  })
  console.log('Daily alerts cron scheduled (08:00 daily)')

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`GuardOps API running on port ${PORT}`)
  })
}

start().catch(e => { console.error('Failed to start:', e); process.exit(1) })
