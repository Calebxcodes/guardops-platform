import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL     = process.env.FROM_EMAIL     || 'noreply@strondis.com'
const APP_URL        = process.env.APP_URL        || 'https://strondis.com'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return
  }
  const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
  if (error) console.error('[EMAIL] Send error:', error)
}

export async function sendPasswordReset(to: string, token: string, userType: 'admin' | 'guard') {
  const base = userType === 'admin' ? APP_URL : (process.env.GUARD_APP_URL || APP_URL)
  const link = `${base}/reset-password?token=${token}`
  await send(to, 'Reset your Strondis password', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="margin-bottom:20px">
        <div style="display:inline-flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-weight:900;font-size:18px;font-family:Arial Black,sans-serif">S</span>
          </div>
          <span style="font-weight:700;font-size:18px;color:#111827">Strondis</span>
        </div>
      </div>
      <h2 style="color:#111827;margin:0 0 8px">Reset your password</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px">
        You requested a password reset for your Strondis account. Click the button below to set a new password — this link expires in <strong>1 hour</strong>.
      </p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Reset Password →
      </a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="color:#d1d5db;font-size:11px">Strondis Ltd · noreply@strondis.com</p>
    </div>
  `)
}

export async function sendGuardNotificationEmail(
  to: string,
  firstName: string,
  payload: { title: string; body: string; url?: string }
) {
  const guardAppUrl = process.env.GUARD_APP_URL || 'https://guard-app-ten.vercel.app'
  const link = payload.url ? `${guardAppUrl}${payload.url}` : guardAppUrl
  await send(to, payload.title, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
      <div style="margin-bottom:20px">
        <span style="display:inline-block;background:#1e3a8a;color:#93c5fd;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.05em">STRONDIS GUARD</span>
      </div>
      <h2 style="color:#f1f5f9;margin:0 0 8px">${payload.title}</h2>
      <p style="color:#94a3b8;margin:0 0 20px">Hi ${firstName}, ${payload.body}</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Open Strondis Guard →
      </a>
      <p style="color:#475569;font-size:11px;margin-top:24px">You received this because you have notifications enabled on your Strondis Guard account.</p>
    </div>
  `)
}

export async function sendInvitation(
  to: string,
  token: string,
  role: string,
  tenantName: string,
  tenantId: number
) {
  const appUrl = process.env.APP_URL || 'https://app.strondis.com'
  const link = `${appUrl}/accept-invite?token=${token}&tenantId=${tenantId}`
  const roleDisplay = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  await send(to, `You've been invited to join ${tenantName} on Strondis`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="margin-bottom:20px">
        <div style="display:inline-flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-weight:900;font-size:18px;font-family:Arial Black,sans-serif">S</span>
          </div>
          <span style="font-weight:700;font-size:18px;color:#111827">Strondis</span>
        </div>
      </div>
      <h2 style="color:#111827;margin:0 0 8px">You're invited to join ${tenantName}</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px">
        You've been invited as a <strong>${roleDisplay}</strong>. Click the button below to set your password and get started.
      </p>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 24px">This invitation expires in <strong>24 hours</strong>.</p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Accept Invitation →
      </a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="color:#d1d5db;font-size:11px">Strondis Ltd · noreply@strondis.com</p>
    </div>
  `)
}

export async function sendRoleChangeNotification(to: string, oldRole: string, newRole: string) {
  const oldDisplay = oldRole.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const newDisplay = newRole.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const appUrl = process.env.APP_URL || 'https://app.strondis.com'
  await send(to, 'Your Strondis role has been updated', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="margin-bottom:20px">
        <div style="display:inline-flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-weight:900;font-size:18px;font-family:Arial Black,sans-serif">S</span>
          </div>
          <span style="font-weight:700;font-size:18px;color:#111827">Strondis</span>
        </div>
      </div>
      <h2 style="color:#111827;margin:0 0 8px">Your role has been updated</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px">
        Your role has changed from <strong>${oldDisplay}</strong> to <strong>${newDisplay}</strong>.
      </p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px">
        Please log out and log back in to see your updated permissions.
      </p>
      <a href="${appUrl}/login" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Log In →
      </a>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="color:#d1d5db;font-size:11px">Strondis Ltd · noreply@strondis.com</p>
    </div>
  `)
}

export async function sendAlertEmail(to: string, subject: string, lines: string[]) {
  await send(to, subject, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-weight:900;font-size:16px;font-family:Arial Black,sans-serif">S</span>
        </div>
        <span style="font-weight:700;font-size:16px;color:#111827">Strondis Daily Alert</span>
      </div>
      <ul style="line-height:1.8;color:#374151;padding-left:20px">
        ${lines.map(l => `<li>${l}</li>`).join('')}
      </ul>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="color:#d1d5db;font-size:11px">Strondis Operations Platform — automated daily digest</p>
    </div>
  `)
}
