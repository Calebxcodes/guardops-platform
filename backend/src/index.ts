import express from 'express'
import cors from 'cors'
import { getDb } from './db/schema'
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

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Initialize DB on startup
const db = getDb()

// Auto-seed if DB is empty (first deploy)
const guardCount = (db.prepare('SELECT COUNT(*) as c FROM guards').get() as any).c
if (guardCount === 0) {
  console.log('Empty DB detected — running seed...')
  try {
    require('./db/seed')
    console.log('Seed complete.')
  } catch (e) {
    console.error('Seed failed:', e)
  }
}

// Ensure default admin account exists
ensureDefaultAdmin()

// Admin/CRM routes
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

// Guard app routes
app.use('/api/auth', authRouter)
app.use('/api/guard/shifts', guardShiftsRouter)
app.use('/api/guard/timesheets', guardTimesheetsRouter)
app.use('/api/guard/messages', guardMessagesRouter)
app.use('/api/guard/profile', guardProfileRouter)

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`GuardOps API running on port ${PORT}`)
})
