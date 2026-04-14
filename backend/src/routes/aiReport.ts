import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.post('/incident/:id', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT i.*, s.name as site_name, s.address as site_address, s.post_orders,
           g.first_name, g.last_name, g.certifications,
           c.name as client_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE i.id = $1
  `, [req.params.id]) as { rows: any[] }

  const incident = rows[0]
  if (!incident) return res.status(404).json({ error: 'Incident not found' })

  // Strip characters that could be used for prompt injection before interpolating into the AI prompt
  const safe = (s: string | null | undefined, maxLen = 500) =>
    (s ?? 'Not recorded').replace(/[`\[\]<>{}\\]/g, '').slice(0, maxLen)

  const prompt = `You are a professional security operations AI generating a formal incident report for a UK security company, compliant with BS 7499 standards.

Generate a complete, professional incident report based on this data:

INCIDENT DETAILS:
- Type: ${safe(incident.type)}
- Severity: ${safe(incident.severity)}
- Date/Time: ${new Date(incident.created_at).toLocaleString('en-GB')}
- Site: ${safe(incident.site_name)}
- Site Address: ${safe(incident.site_address)}
- Client: ${safe(incident.client_name)}
- Reporting Officer: ${safe(incident.first_name)} ${safe(incident.last_name)}
- Description: ${safe(incident.description || 'No description provided', 2000)}
- Body Camera: ${incident.bodycam ? 'Yes - footage secured' : 'No'}
- Status: ${incident.resolved ? 'Resolved' : 'Under investigation'}

FORMAT THE REPORT AS FOLLOWS:
1. INCIDENT REFERENCE: [Generate a reference like SE-YYYYMMDD-XXXX]
2. INCIDENT SUMMARY (2-3 sentences, factual and professional)
3. TIMELINE OF EVENTS (bullet points with times where known)
4. ACTIONS TAKEN (what the officer did, who was notified)
5. EVIDENCE SECURED (bodycam, CCTV, witness details if applicable)
6. RESOLUTION STATUS
7. RECOMMENDATIONS (any follow-up actions for the client or management)
8. OFFICER DECLARATION (standard declaration statement)

Keep the language formal, factual, and suitable for submission to a client, police, or regulatory body. Avoid speculation. Use passive voice where appropriate.`

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      const report = generateTemplateReport(incident)
      await query('UPDATE incidents SET ai_report = $1 WHERE id = $2', [report, incident.id])
      return res.json({ report, source: 'template' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json() as any
    const report = data.content?.[0]?.text || generateTemplateReport(incident)
    await query('UPDATE incidents SET ai_report = $1 WHERE id = $2', [report, incident.id])
    res.json({ report, source: 'ai' })
  } catch (err) {
    console.error('AI report error:', err)
    const report = generateTemplateReport(incident)
    await query('UPDATE incidents SET ai_report = $1 WHERE id = $2', [report, incident.id])
    res.json({ report, source: 'template' })
  }
})

function generateTemplateReport(incident: any): string {
  const date = new Date(incident.created_at)
  const ref = `SE-${date.toISOString().slice(0,10).replace(/-/g,'')}-${String(incident.id).padStart(4,'0')}`
  return `STRONDIS INCIDENT REPORT
Reference: ${ref}
Generated: ${new Date().toLocaleString('en-GB')}

INCIDENT SUMMARY
On ${date.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} at ${date.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}, a ${incident.severity} incident of type "${incident.type}" was recorded at ${incident.site_name} (${incident.client_name}).

REPORTING OFFICER
${incident.first_name} ${incident.last_name}

SITE
${incident.site_name}
${incident.site_address || ''}
Client: ${incident.client_name}

DESCRIPTION
${incident.description || 'No description provided.'}

EVIDENCE
Body Camera Footage: ${incident.bodycam ? 'Secured and archived' : 'Not available'}

RESOLUTION STATUS
${incident.resolved ? `Resolved on ${new Date(incident.resolved_at).toLocaleString('en-GB')}` : 'Under investigation — no further action taken at time of filing'}

OFFICER DECLARATION
I confirm that the information recorded in this report is accurate to the best of my knowledge and was recorded contemporaneously with the events described.

Officer: ${incident.first_name} ${incident.last_name}
Report ID: ${ref}
Platform: Strondis Operations Platform`
}

export default router
