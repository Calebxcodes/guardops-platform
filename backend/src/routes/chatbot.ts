import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requirePermission } from '../middleware/rbac'
import { pool } from '../db/schema'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-3-5-sonnet-20241022'

const GLOBAL_KB = `
# Strondis Knowledge Base

## Shifts
Q: How do I create a shift?
A: Go to Scheduling, click "New Shift", select site, date/time, and assign a guard. Save to create.

Q: How do I assign a guard to a shift?
A: Open the shift in Scheduling, click the guard field, and select from available guards. Guards receive a notification.

Q: How do I edit a shift?
A: Click the shift in the Scheduling calendar, update any field (site, guard, time), and save.

Q: How does clock-in/clock-out work?
A: Guards clock in and out via the Guard app. Admins can see real-time clock events in Timesheets.

Q: What shift statuses are there?
A: Unassigned, Assigned, In Progress, Completed, and Missed.

Q: How do I delete a shift?
A: Open the shift in Scheduling and click Delete. This cannot be undone if payroll is generated.

## Guards
Q: How do I add a guard?
A: Go to Guards, click "Add Guard", fill in their details (name, email, hourly rate, certifications), and save.

Q: How do I deactivate a guard?
A: Open the guard's profile, scroll to the bottom, and click "Deactivate". They will no longer appear in scheduling.

Q: How do I manage guard certifications?
A: Open the guard profile and update the Certifications field with comma-separated values (e.g., SIA, First Aid).

Q: How do I set a guard's hourly rate?
A: Open the guard profile and update the Hourly Rate field. This automatically applies to new payroll calculations.

Q: How do I delete a guard?
A: Open the guard profile, click Delete Guard, and confirm with your password. Guard records are soft-deleted.

## Payroll
Q: How do I generate payroll?
A: Go to Payroll, click "Generate Payroll", enter the pay period dates and tax rate, then click Generate.

Q: How do I approve payroll?
A: In the Payroll list, update the status of each record to "Approved" or "Paid" as appropriate.

Q: What does gross pay include?
A: Gross pay = Regular hours × hourly rate + Overtime hours × hourly rate × 1.5 + Bonuses.

Q: How is overtime calculated?
A: Overtime is based on the threshold set in Settings (default: 40 hours/week). Hours above the threshold are at 1.5×.

Q: Can I add bonuses to payroll?
A: Yes. Open the payroll record, edit the Bonuses field, and save. Net pay recalculates automatically.

## Timesheets
Q: How are timesheets created?
A: Timesheets are auto-created from approved clock events, or guards can submit them manually via the Guard app.

Q: How do I approve a timesheet?
A: Go to Timesheets, find the timesheet, and click Approve. The guard receives a notification.

Q: How do I bulk approve timesheets?
A: In the Timesheets list, select multiple rows with the checkbox and click "Bulk Approve".

## Clients & Sites
Q: How do I add a client?
A: Go to Clients, click "Add Client", enter their name and contact details, and save.

Q: How do I add a site?
A: Go to Sites, click "Add Site", select the client, enter the site address and requirements, and save.

Q: How do I set a geofence for a site?
A: Open the site, set the Geofence Radius (in metres), and save. Guards must clock in within this radius.

## Incidents
Q: How do I report an incident?
A: Go to Incidents, click "New Incident", select the site, guard, and severity, describe the incident, and save.

Q: How do I resolve an incident?
A: Open the incident and click "Mark Resolved". The incident is timestamped and closed.

Q: Can I generate an AI report for an incident?
A: Yes. Open the incident and click "Generate AI Report". An AI summary will be created automatically.

## Users & Roles
Q: How do I invite a team member?
A: Go to Settings → Team Members, click "Invite User", enter their email and role, and send.

Q: What roles are available?
A: Owner, Manager, Scheduler, Payroll Manager, and Viewer. Each has different permissions.

Q: How do I change a team member's role?
A: Go to Settings → Team Members, find the user, and select a new role from the dropdown.

## Reports & Analytics
Q: Where can I see analytics?
A: Go to the Analytics page for revenue, workforce, incident, and site performance reports.

Q: How do I export my data?
A: Go to Settings, scroll to Data & Account Management, click "Export Data", and confirm with your password.
`

// In-memory rate limit: 100 messages per tenant per calendar day
const dailyUsage = new Map<string, number>()
function getDailyKey(tenantId: number): string {
  return `${tenantId}:${new Date().toDateString()}`
}
function checkRateLimit(tenantId: number): boolean {
  const key = getDailyKey(tenantId)
  const count = dailyUsage.get(key) ?? 0
  if (count >= 100) return false
  dailyUsage.set(key, count + 1)
  return true
}

// POST /api/chatbot/message
router.post('/message', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const { message, history } = req.body as { message: string; history?: { role: string; content: string }[] }

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' })
  }

  if (!checkRateLimit(tenantId)) {
    return res.status(429).json({ success: false, message: 'Daily message limit reached (100). Please try again tomorrow.' })
  }

  // Fetch tenant KB overrides (tenant-specific additions)
  let tenantKbAdditions = ''
  try {
    const { rows } = await pool.query(
      `SELECT title, content FROM public.chatbot_kb WHERE tenant_id = $1 ORDER BY category, title`,
      [tenantId]
    )
    if (rows.length > 0) {
      tenantKbAdditions = '\n\n## Your Company Customizations\n' +
        rows.map((r: any) => `Q: ${r.title}\nA: ${r.content}`).join('\n\n')
    }
  } catch { /* KB table may not exist yet — proceed without customizations */ }

  const systemPrompt = `You are Strondis Assistant, a helpful AI support chatbot for Strondis — a security guard management platform.

Use this knowledge base to answer questions:
${GLOBAL_KB}${tenantKbAdditions}

Rules:
1. Keep responses short: 1-2 sentences maximum.
2. Use markdown formatting (bold for key terms, bullet points when listing).
3. Answer naturally — no need to cite the knowledge base.
4. If a question is not about Strondis or security guard management, respond: "I can only help with Strondis-related questions."
5. Be friendly, concise, and professional.`

  const contextMessages = (history ?? []).slice(-50) as { role: 'user' | 'assistant'; content: string }[]

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        ...contextMessages,
        { role: 'user', content: message },
      ],
    })

    const botText = response.content[0].type === 'text' ? response.content[0].text : ''
    const outOfScope = botText.toLowerCase().includes('i can only help with strondis')

    return res.json({ success: true, content: botText, outOfScope })
  } catch (err: any) {
    console.error('[chatbot/message]', err.message)
    return res.status(500).json({ success: false, message: 'Failed to get response. Please try again.' })
  }
})

// POST /api/chatbot/feedback
router.post('/feedback', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const { messageId, feedback } = req.body as { messageId: string; feedback: 'helpful' | 'unhelpful' }

  try {
    await pool.query(
      `INSERT INTO public.chatbot_feedback (tenant_id, message_id, feedback, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [tenantId, messageId, feedback, Math.floor(Date.now() / 1000)]
    )
  } catch { /* non-critical — don't fail the response */ }

  return res.json({ success: true })
})

// POST /api/chatbot/escalate
router.post('/escalate', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const { messages } = req.body as { messages: { role: string; content: string }[] }

  try {
    const description = (messages ?? [])
      .map((m: any) => `${m.role}: ${m.content}`)
      .join('\n')

    await pool.query(
      `INSERT INTO public.support_tickets (tenant_id, title, description, source, status, created_at)
       VALUES ($1, $2, $3, 'chatbot', 'open', $4)`,
      [tenantId, 'Chatbot Escalation', description, Math.floor(Date.now() / 1000)]
    )
  } catch (err: any) {
    console.error('[chatbot/escalate]', err.message)
    return res.status(500).json({ success: false, message: 'Failed to create support ticket' })
  }

  return res.json({ success: true, message: 'Support ticket created. We will respond within 24 hours.' })
})

// GET /api/chatbot/kb — owner only (requirePermission checks owner/manager via 'settings' feature)
router.get('/kb', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  try {
    const { rows } = await pool.query(
      `SELECT id, title, content, category FROM public.chatbot_kb
       WHERE tenant_id = $1
       ORDER BY category, title`,
      [tenantId]
    )
    return res.json({ success: true, items: rows })
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch KB items' })
  }
})

// PUT /api/chatbot/kb/:id — owner only
router.put('/kb/:id', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const { content, title } = req.body as { content?: string; title?: string }
  try {
    await pool.query(
      `UPDATE public.chatbot_kb SET content = COALESCE($1, content), title = COALESCE($2, title), updated_at = $3
       WHERE id = $4 AND tenant_id = $5`,
      [content ?? null, title ?? null, Math.floor(Date.now() / 1000), req.params.id, tenantId]
    )
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update KB item' })
  }
})

// POST /api/chatbot/kb — owner only (add custom KB item)
router.post('/kb', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const { title, content, category } = req.body as { title: string; content: string; category?: string }
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ success: false, message: 'title and content are required' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.chatbot_kb (tenant_id, title, content, category, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, title.trim(), content.trim(), category?.trim() || 'Custom', Math.floor(Date.now() / 1000)]
    )
    return res.status(201).json({ success: true, id: rows[0].id })
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to add KB item' })
  }
})

// DELETE /api/chatbot/kb/:id — owner only
router.delete('/kb/:id', requirePermission('settings', 'update'), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  try {
    await pool.query(
      `DELETE FROM public.chatbot_kb WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId]
    )
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete KB item' })
  }
})

export default router
