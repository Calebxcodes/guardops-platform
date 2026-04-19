import './instrument' // must be first — patches pg/http before other imports
import 'dotenv/config'
import 'express-async-errors'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'
import { initSchema, query, PgRateLimitStore } from './db/schema'
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
import adminAuthRouter, { ensureDefaultAdmin, requireAdmin } from './routes/adminAuth'
import { runDailyAlerts } from './services/alerts'
import complianceRouter from './routes/compliance'
import aiReportRouter from './routes/aiReport'
import clientPortalRouter from './routes/clientPortal'
import pushRouter from './routes/push'
import adminMessagesRouter from './routes/adminMessages'
import adminNotificationsRouter from './routes/adminNotifications'
import analyticsRouter from './routes/analytics'
import documentsRouter from './routes/documents'
import guardDocumentsRouter from './routes/guardDocuments'
import { notifyGuard } from './services/push'
import * as Sentry from '@sentry/node'
import { registerGuardSSE, registerAdminSSE } from './services/sse'
import { consumeGuardStreamToken, consumeAdminStreamToken } from './services/streamTokens'

// ── Environment validation (fail fast if critical vars are missing) ────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET']
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k])
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`)
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3001
const IS_PROD = process.env.NODE_ENV === 'production'

// Trust Railway / Vercel reverse proxy so rate-limiter sees real client IPs
app.set('trust proxy', 1)

// ── Response compression (gzip / br) ─────────────────────────────────────────
app.use(compression())

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
// File uploads use multer (multipart), not this JSON parser
app.use(express.json({ limit: '512kb' }))

// ── Rate limiting (PostgreSQL-backed — enforced across all instances) ─────────
// Key by email for auth endpoints — prevents brute force even under CGNAT/dynamic IPs.
// Falls back to req.ip if email not provided.
const authKeyByEmail = (req: Request) => {
  const email = req.body?.email
  return email ? `auth_email::${String(email).toLowerCase().slice(0, 254)}` : `auth_ip::${req.ip}`
}
const resetKeyByEmail = (req: Request) => {
  const email = req.body?.email
  return email ? `reset_email::${String(email).toLowerCase().slice(0, 254)}` : `reset_ip::${req.ip}`
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKeyByEmail,
  store: new PgRateLimitStore(15 * 60 * 1000),
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
})
// Stricter limit for password reset — prevents token enumeration & email flooding
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resetKeyByEmail,
  store: new PgRateLimitStore(60 * 60 * 1000),
  message: { error: 'Too many password reset requests — please try again in an hour' },
})
// Per-guard clock event limiter — keyed by guard JWT (req.ip fallback)
const clockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore(15 * 60 * 1000),
  message: { error: 'Too many clock requests — please wait before trying again' },
})
// Biometric & password change limiter — expensive operations, low legitimate frequency
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore(15 * 60 * 1000),
  message: { error: 'Too many requests — please try again shortly' },
})

// Portal token lookup — strict limit to prevent brute-force token enumeration
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore(15 * 60 * 1000),
  message: { error: 'Too many requests — please try again shortly' },
})
app.use('/api/portal/:token', portalLimiter)

app.use('/api/auth/login',                        authLimiter)
app.use('/api/admin/auth/login',                  authLimiter)
app.use('/api/auth/forgot-password',              resetLimiter)
app.use('/api/auth/reset-password',               resetLimiter)
app.use('/api/admin/auth/forgot-password',        resetLimiter)
app.use('/api/admin/auth/reset-password',         resetLimiter)
app.use('/api/auth/change-password',              sensitiveLimiter)
app.use('/api/guard/shifts/clock-in',             clockLimiter)
app.use('/api/guard/shifts/clock-out',            clockLimiter)
app.use('/api/guard/profile/face-descriptor',     sensitiveLimiter)

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/admin/auth', adminAuthRouter)
// All admin data routes require a valid admin JWT
app.use('/api/guards',     requireAdmin, guardsRouter)
app.use('/api/clients',    requireAdmin, clientsRouter)
app.use('/api/sites',      requireAdmin, sitesRouter)
app.use('/api/shifts',     requireAdmin, shiftsRouter)
app.use('/api/timesheets', requireAdmin, timesheetsRouter)
app.use('/api/payroll',    requireAdmin, payrollRouter)
app.use('/api/dashboard',  requireAdmin, dashboardRouter)
app.use('/api/incidents',  requireAdmin, incidentsRouter)
app.use('/api/compliance', requireAdmin, complianceRouter)
app.use('/api/ai',         requireAdmin, aiReportRouter)
app.use('/api/portal', clientPortalRouter)
app.use('/api/auth', authRouter)
app.use('/api/guard/shifts', guardShiftsRouter)
app.use('/api/guard/timesheets', guardTimesheetsRouter)
// SSE stream endpoints — authenticated via one-time stream token (EventSource can't send headers)
// Must be registered BEFORE the guarded router mounts below
app.get('/api/guard/messages/stream', (req, res) => {
  const guardId = consumeGuardStreamToken(String(req.query.token ?? ''))
  if (!guardId) return res.status(401).json({ error: 'Invalid or expired stream token' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const cleanup = registerGuardSSE(guardId, res)
  req.on('close', cleanup)
})

app.get('/api/messages/stream', (req, res) => {
  const adminId = consumeAdminStreamToken(String(req.query.token ?? ''))
  if (!adminId) return res.status(401).json({ error: 'Invalid or expired stream token' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const cleanup = registerAdminSSE(res)
  req.on('close', cleanup)
})

app.use('/api/guard/messages',   guardMessagesRouter)
app.use('/api/guard/profile',    guardProfileRouter)
app.use('/api/guard/push',       pushRouter)
app.use('/api/guard/documents',  guardDocumentsRouter)
app.use('/api/messages',         requireAdmin, adminMessagesRouter)
app.use('/api/admin/notifications', requireAdmin, adminNotificationsRouter)
app.use('/api/analytics',        requireAdmin, analyticsRouter)
app.use('/api/documents',        requireAdmin, documentsRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Sentry error handler (must come after routes, before custom handler) ─────
Sentry.setupExpressErrorHandler(app)

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

  // ── Push notification crons ────────────────────────────────────────────────

  // Clock-in reminders — every 5 minutes, for shifts starting in 25-35 min
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { rows } = await query(`
        SELECT sh.id, sh.guard_id, sh.start_time, s.name as site_name
        FROM shifts sh
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.status = 'assigned'
          AND sh.guard_id IS NOT NULL
          AND sh.start_time BETWEEN NOW() + INTERVAL '25 minutes' AND NOW() + INTERVAL '35 minutes'
      `)
      for (const sh of rows) {
        const { format: fmt } = await import('date-fns')
        const when = fmt(new Date(sh.start_time), 'HH:mm')
        await notifyGuard(sh.guard_id, {
          title: 'Shift Starting Soon',
          body: `Clock in for your shift at ${sh.site_name} starting at ${when}`,
          url: '/',
          tag: `clock-in-reminder-${sh.id}`,
          urgency: 'high',
        })
      }
      if (rows.length > 0) console.log(`[Push] Clock-in reminders sent: ${rows.length}`)
    } catch (e: any) { console.error('[Push] Clock-in cron error:', e.message) }
  })

  // Clock-out reminders — every 5 minutes, for shifts ending in 10-20 min
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { rows } = await query(`
        SELECT sh.id, sh.guard_id, sh.end_time, s.name as site_name
        FROM shifts sh
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.status = 'in-progress'
          AND sh.guard_id IS NOT NULL
          AND sh.end_time BETWEEN NOW() + INTERVAL '10 minutes' AND NOW() + INTERVAL '20 minutes'
      `)
      for (const sh of rows) {
        const { format: fmt } = await import('date-fns')
        const when = fmt(new Date(sh.end_time), 'HH:mm')
        await notifyGuard(sh.guard_id, {
          title: 'Shift Ending Soon',
          body: `Your shift at ${sh.site_name} ends at ${when} — remember to clock out`,
          url: '/',
          tag: `clock-out-reminder-${sh.id}`,
          urgency: 'high',
        })
      }
      if (rows.length > 0) console.log(`[Push] Clock-out reminders sent: ${rows.length}`)
    } catch (e: any) { console.error('[Push] Clock-out cron error:', e.message) }
  })

  // Hourly check prompts — every hour on the hour, for all in-progress shifts
  cron.schedule('0 * * * *', async () => {
    try {
      const { rows } = await query(`
        SELECT sh.id, sh.guard_id, s.name as site_name
        FROM shifts sh
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.status = 'in-progress'
          AND sh.guard_id IS NOT NULL
          AND sh.start_time <= NOW()
          AND sh.end_time   >= NOW()
      `)
      for (const sh of rows) {
        await notifyGuard(sh.guard_id, {
          title: 'Hourly Site Check',
          body: `Complete your hourly check report for ${sh.site_name}`,
          url: '/',
          tag: `hourly-check-${sh.id}`,
          urgency: 'normal',
        })
      }
      if (rows.length > 0) console.log(`[Push] Hourly check prompts sent: ${rows.length}`)
    } catch (e: any) { console.error('[Push] Hourly check cron error:', e.message) }
  })

  // Missed clock-in alert — every 10 minutes, for shifts that started >15 min ago without clock-in
  cron.schedule('*/10 * * * *', async () => {
    try {
      const { rows } = await query(`
        SELECT sh.id, sh.guard_id, sh.start_time, s.name as site_name
        FROM shifts sh
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.status = 'assigned'
          AND sh.guard_id IS NOT NULL
          AND sh.start_time BETWEEN NOW() - INTERVAL '60 minutes' AND NOW() - INTERVAL '15 minutes'
      `)
      for (const sh of rows) {
        const { format: fmt } = await import('date-fns')
        const when = fmt(new Date(sh.start_time), 'HH:mm')
        await notifyGuard(sh.guard_id, {
          title: 'Missed Clock-In',
          body: `Your shift at ${sh.site_name} started at ${when} — please clock in immediately`,
          url: '/',
          tag: `missed-clock-in-${sh.id}`,
          urgency: 'critical',
        })
      }
      if (rows.length > 0) console.log(`[Push] Missed clock-in alerts sent: ${rows.length}`)
    } catch (e: any) { console.error('[Push] Missed clock-in cron error:', e.message) }
  })

  console.log('Push notification crons scheduled')

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`GuardOps API running on port ${PORT}`)
  })
}

start().catch(e => { console.error('Failed to start:', e); process.exit(1) })
