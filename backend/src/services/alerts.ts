import { query } from '../db/schema'
import { sendAlertEmail } from './email'

const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || ''

export async function runDailyAlerts() {
  if (!ADMIN_ALERT_EMAIL) {
    console.log('[Alerts] No ADMIN_ALERT_EMAIL set — skipping daily alert email')
    return
  }

  const lines: string[] = []

  // ── SIA licences expiring within 30 days ──────────────────────────────────
  const { rows: guards } = await query(`
    SELECT first_name, last_name, email, certifications
    FROM guards WHERE active = 1
  `)

  const today = new Date()
  for (const g of guards) {
    const certs = JSON.parse(g.certifications || '[]')
    const siaCert = certs.find((c: any) =>
      c.name?.toLowerCase().includes('sia') ||
      c.name?.toLowerCase().includes('door supervisor') ||
      c.name?.toLowerCase().includes('security guard licen')
    )
    if (!siaCert?.expiry) continue
    const expiry = new Date(siaCert.expiry)
    const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000)
    if (daysLeft < 0) {
      lines.push(`<strong style="color:#dc2626">EXPIRED</strong> SIA licence — ${g.first_name} ${g.last_name} (${g.email}) — expired ${Math.abs(daysLeft)} day(s) ago`)
    } else if (daysLeft <= 30) {
      lines.push(`<strong style="color:#ea580c">Expiring in ${daysLeft} day(s)</strong> — ${g.first_name} ${g.last_name} (${g.email})`)
    }
  }

  // ── Unassigned shifts in the next 7 days ─────────────────────────────────
  const { rows: unassigned } = await query(`
    SELECT sh.start_time, sh.end_time, s.name as site_name
    FROM shifts sh
    LEFT JOIN sites s ON s.id = sh.site_id
    WHERE sh.status = 'unassigned'
      AND sh.start_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ORDER BY sh.start_time
  `)

  for (const sh of unassigned) {
    const dt = new Date(sh.start_time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    lines.push(`<strong style="color:#b45309">Unassigned shift</strong> at ${sh.site_name} on ${dt}`)
  }

  if (lines.length === 0) {
    console.log('[Alerts] Daily check: no issues found')
    return
  }

  await sendAlertEmail(
    ADMIN_ALERT_EMAIL,
    `Strondis Alert: ${lines.length} item(s) require attention`,
    lines
  )
  console.log(`[Alerts] Sent daily alert with ${lines.length} item(s) to ${ADMIN_ALERT_EMAIL}`)
}
