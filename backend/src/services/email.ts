import { Resend } from 'resend'

const RESEND_API_KEY  = process.env.RESEND_API_KEY
const FROM_EMAIL      = process.env.FROM_EMAIL      || 'noreply@strondis.com'
const FRONTEND_URL    = process.env.FRONTEND_URL    || 'https://app.strondis.com'
const GUARD_APP_URL   = process.env.GUARD_APP_URL   || 'https://guard.strondis.com'

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
  const base = userType === 'admin' ? FRONTEND_URL : (process.env.GUARD_APP_URL || FRONTEND_URL)
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
  tenantId: number,
  tenantSlug?: string
) {
  // New links use {slug}.strondis.com — tenantId is implicit from subdomain
  // Fallback to FRONTEND_URL for local dev or missing slug
  const baseUrl = tenantSlug
    ? `https://${tenantSlug}.strondis.com`
    : FRONTEND_URL
  const link = `${baseUrl}/accept-invite?token=${token}`
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
  const appUrl = FRONTEND_URL
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

export async function sendTimeOffRequestToAdmin(
  to: string,
  guardName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  days: number
) {
  await send(to, `Time Off Request — ${guardName}`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-weight:900;font-size:18px;font-family:Arial Black,sans-serif">S</span>
        </div>
        <span style="font-weight:700;font-size:18px;color:#111827">Strondis</span>
      </div>
      <h2 style="color:#111827;margin:0 0 8px">New Time Off Request</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 16px">
        <strong>${guardName}</strong> has submitted a time off request that requires your review.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Leave Type</td><td style="padding:8px 0;color:#111827;font-weight:600">${leaveType}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">From</td><td style="padding:8px 0;color:#111827;font-weight:600">${startDate}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">To</td><td style="padding:8px 0;color:#111827;font-weight:600">${endDate}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Duration</td><td style="padding:8px 0;color:#111827;font-weight:600">${days} day${days !== 1 ? 's' : ''}</td></tr>
      </table>
      <a href="${FRONTEND_URL}/hr" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Review Request →
      </a>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="color:#d1d5db;font-size:11px">Strondis Ltd · noreply@strondis.com</p>
    </div>
  `)
}

export async function sendGuardWelcomeEmail(
  to: string,
  guardName: string,
  companyName: string,
  resetToken: string,
  tenantSlug?: string
) {
  const guardBase = tenantSlug ? `https://${tenantSlug}.strondis.com` : GUARD_APP_URL
  const resetLink = `${guardBase}/reset-password?token=${resetToken}`
  await send(to, `Welcome to ${companyName} — Set Your Password`, `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:600px;margin:0 auto;padding:24px">
        <div style="background:#2563eb;border-radius:12px 12px 0 0;padding:24px 28px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center">
              <span style="color:white;font-weight:900;font-size:18px">S</span>
            </div>
            <span style="color:white;font-weight:700;font-size:18px">${companyName}</span>
          </div>
          <h1 style="color:white;margin:16px 0 4px;font-size:22px">Welcome, ${guardName}!</h1>
          <p style="color:rgba(255,255,255,0.8);margin:0;font-size:14px">Your officer account has been created</p>
        </div>

        <div style="background:white;padding:28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
            Hi ${guardName},<br><br>
            Your account at <strong>${companyName}</strong> has been set up on the Strondis platform.
            Click below to set your password and get started.
          </p>

          <div style="text-align:center;margin:28px 0">
            <a href="${resetLink}"
               style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.01em">
              Set Your Password →
            </a>
          </div>

          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin:20px 0">
            <p style="color:#92400e;font-size:13px;margin:0">
              ⏰ This link expires in <strong>24 hours</strong>. After that, ask your manager to resend the welcome email.
            </p>
          </div>

          <p style="color:#6b7280;font-size:13px;margin:16px 0 0">
            If you weren't expecting this email, you can safely ignore it.
            Your account will remain inactive until you set a password.
          </p>
        </div>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center">
          <p style="color:#9ca3af;font-size:11px;margin:0">
            © 2026 Strondis Security — <a href="https://strondis.com" style="color:#9ca3af">strondis.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `)
}

export async function sendTimeOffDecisionToGuard(
  to: string,
  firstName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  decision: 'approved' | 'rejected',
  note?: string
) {
  const approved = decision === 'approved'
  const colour = approved ? '#16a34a' : '#dc2626'
  const label  = approved ? 'Approved' : 'Rejected'
  const guardAppUrl = process.env.GUARD_APP_URL || 'https://guard.strondis.com'
  await send(to, `Time Off Request ${label}`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;border-radius:12px">
      <div style="margin-bottom:20px">
        <span style="display:inline-block;background:#1e3a8a;color:#93c5fd;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.05em">STRONDIS GUARD</span>
      </div>
      <h2 style="color:#f1f5f9;margin:0 0 8px">Time Off Request <span style="color:${colour}">${label}</span></h2>
      <p style="color:#94a3b8;margin:0 0 16px">Hi ${firstName},</p>
      <p style="color:#94a3b8;margin:0 0 20px">
        Your ${leaveType} request from <strong style="color:#e2e8f0">${startDate}</strong> to <strong style="color:#e2e8f0">${endDate}</strong>
        has been <strong style="color:${colour}">${label.toLowerCase()}</strong>.
      </p>
      ${note ? `<p style="color:#94a3b8;margin:0 0 20px;padding:12px;background:#1e293b;border-radius:6px;font-size:14px"><strong style="color:#e2e8f0">Note:</strong> ${note}</p>` : ''}
      <a href="${guardAppUrl}/time-off" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View My Requests →
      </a>
      <p style="color:#475569;font-size:11px;margin-top:24px">Strondis Ltd · noreply@strondis.com</p>
    </div>
  `)
}
