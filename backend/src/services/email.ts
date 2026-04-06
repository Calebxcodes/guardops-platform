import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@strondis.com'
const APP_URL    = process.env.APP_URL || 'https://strondis.com'

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null

async function send(to: string, subject: string, html: string) {
  if (!transporter) {
    // No SMTP configured — log to console so the app still works without email setup
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return
  }
  await transporter.sendMail({ from: FROM_EMAIL, to, subject, html })
}

export async function sendPasswordReset(to: string, token: string, userType: 'admin' | 'guard') {
  const path = userType === 'admin' ? '/reset-password' : '/reset-password'
  const base = userType === 'admin' ? APP_URL : (process.env.GUARD_APP_URL || APP_URL)
  const link = `${base}${path}?token=${token}`
  await send(to, 'Reset your Strondis password', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8">Password Reset</h2>
      <p>You requested a password reset for your Strondis account.</p>
      <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `)
}

export async function sendAlertEmail(to: string, subject: string, lines: string[]) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8">Strondis Daily Alert</h2>
      <ul style="line-height:1.8">
        ${lines.map(l => `<li>${l}</li>`).join('')}
      </ul>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Strondis Operations Platform — automated daily digest</p>
    </div>
  `
  await send(to, subject, html)
}
