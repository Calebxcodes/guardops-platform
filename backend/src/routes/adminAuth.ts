import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query, auditLog } from '../db/schema'
import { pool, tenantStorage } from '../db/pool'
import jwt from 'jsonwebtoken'
import { sendPasswordReset } from '../services/email'
// Self-contained TOTP (RFC 6238) — no external dependency, works on any Node version
function b32Decode(s: string): Buffer {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  let bits = 0, val = 0
  const out: number[] = []
  for (const ch of clean) {
    val = (val << 5) | alpha.indexOf(ch); bits += 5
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return Buffer.from(out)
}
function b32Encode(buf: Buffer): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, val = 0, result = ''
  for (const byte of buf) { val = (val << 8) | byte; bits += 8; while (bits >= 5) { result += alpha[(val >>> (bits - 5)) & 0x1f]; bits -= 5 } }
  if (bits > 0) result += alpha[(val << (5 - bits)) & 0x1f]
  return result
}
function totpCode(secret: string, step: number): string {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(step))
  const hmac = crypto.createHmac('sha1', b32Decode(secret)).update(buf).digest()
  const off = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off+1] << 16 | hmac[off+2] << 8 | hmac[off+3]) % 1_000_000
  return code.toString().padStart(6, '0')
}
const totp = {
  generateSecret: (): string => b32Encode(crypto.randomBytes(20)),
  verify: (token: string, secret: string): boolean => {
    const step = Math.floor(Date.now() / 1000 / 30)
    return [-1, 0, 1].some(d => totpCode(secret, step + d) === token.replace(/\s/g, ''))
  },
  keyuri: (label: string, issuer: string, secret: string): string => {
    const e = encodeURIComponent
    return `otpauth://totp/${e(issuer)}:${e(label)}?secret=${secret}&issuer=${e(issuer)}&algorithm=SHA1&digits=6&period=30`
  },
}
import QRCode from 'qrcode'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set. Refusing to start.')

function signAdminToken(id: number, email: string, tenantId: number | null = null, adminRole: string = 'owner') {
  return jwt.sign({ adminId: id, email, role: 'admin', adminRole, tenantId }, JWT_SECRET, { expiresIn: '8h' })
}

// Short-lived token issued after password verification when 2FA is required.
// Must be exchanged for a full token via POST /2fa/validate.
function signPartialToken(id: number, tenantId: number | null = null) {
  return jwt.sign({ adminId: id, twofa_pending: true, tenantId }, JWT_SECRET, { expiresIn: '5m' })
}

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 8 }, () => {
    const a = crypto.randomBytes(3).toString('hex').toUpperCase()
    const b = crypto.randomBytes(3).toString('hex').toUpperCase()
    return `${a}-${b}`
  })
  const hashed = plain.map(c => crypto.createHash('sha256').update(c).digest('hex'))
  return { plain, hashed }
}

export function requireAdmin(req: any, res: Response, next: any) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Not admin' })
    req.adminId   = payload.adminId
    req.tenantId  = payload.tenantId ?? null
    req.adminRole = payload.adminRole || 'owner'
    // Activate tenant schema context for all downstream queries in this request
    if (payload.tenantId) {
      tenantStorage.run(payload.tenantId, next)
    } else {
      next()
    }
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Creates the first admin account ONLY on a completely fresh database.
// Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to override the defaults.
// This function NEVER resets or overwrites existing admin passwords.
//
// ONE-TIME RECOVERY: If you need to reset an existing admin's password,
// set RESET_ADMIN_PASSWORD=<new-password> env var, deploy once, then remove it.
export async function ensureDefaultAdmin() {
  // One-time emergency recovery — only runs if the env var is explicitly set
  const resetPassword = process.env.RESET_ADMIN_PASSWORD
  if (resetPassword && resetPassword.length >= 10) {
    console.warn('[SECURITY] RESET_ADMIN_PASSWORD detected — resetting all admin passwords...')
    const hash = await bcrypt.hash(resetPassword, 12)
    const { rowCount } = await query('UPDATE admin_users SET password_hash = $1', [hash])
    const { rows: adminList } = await query('SELECT email FROM admin_users')
    console.warn(`[SECURITY] Reset ${rowCount} admin account(s): ${adminList.map((r: any) => r.email).join(', ')}`)
    console.warn('[SECURITY] Remove RESET_ADMIN_PASSWORD from environment variables immediately.')
    return
  }

  const { rows } = await query('SELECT COUNT(*)::int as c FROM admin_users')
  if (rows[0].c > 0) return // admins already exist — do nothing

  const email    = process.env.ADMIN_EMAIL    || 'admin@strondis.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@Strondis1'
  const hash = await bcrypt.hash(password, 12)
  await query(
    'INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)',
    ['Strondis Admin', email, hash]
  )
  console.warn(`[SECURITY] First-boot admin created: ${email}`)
  console.warn('[SECURITY] Change the admin password immediately after first login.')
}

// ── Admin account lookup ──────────────────────────────────────────────────────

interface AdminAccount { admin: any; tenantId: number | null; slug: string | null }

// Every admin account with this email: the legacy public admin first, then
// tenant admins (owner's own company first). public.tenants only records the
// owner's email, so invited team members are found by looking in each active
// tenant's admin_users.
async function findAdminAccounts(email: string, slug?: string): Promise<AdminAccount[]> {
  const accounts: AdminAccount[] = []
  const { rows: publicRows } = await pool.query('SELECT * FROM public.admin_users WHERE lower(email) = lower($1)', [email])
  if (publicRows[0] && !slug) accounts.push({ admin: publicRows[0], tenantId: null, slug: null })

  const { rows: tenants } = await pool.query(
    `SELECT id, slug, (lower(email) = lower($1)) AS is_owner FROM public.tenants
     WHERE status NOT IN ('cancelled', 'deleted') AND ($2::text IS NULL OR slug = $2)
     ORDER BY is_owner DESC, id`,
    [email, slug ?? null]
  )
  const found = await Promise.all(tenants.map(async (t: any) => {
    const tid = Number(t.id)
    try {
      const { rows } = await pool.query(`SELECT * FROM tenant_${tid}.admin_users WHERE lower(email) = lower($1)`, [email])
      return rows[0] ? { admin: rows[0], tenantId: tid, slug: t.slug as string } : null
    } catch {
      return null // schema missing or mid-provisioning
    }
  }))
  for (const a of found) if (a) accounts.push(a)
  return accounts
}

// ── Password login ────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  const { email, password, slug: requestedSlug } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const accounts = await findAdminAccounts(email, requestedSlug || undefined)
  if (accounts.length === 0) return res.status(401).json({ error: 'Invalid credentials' })
  const withPassword = accounts.filter(a => a.admin.password_hash)
  if (withPassword.length === 0) return res.status(401).json({ error: 'This account uses SSO — please sign in with Google or Microsoft' })

  // The same email may be an admin in more than one company; the password picks the account.
  let match: AdminAccount | null = null
  for (const a of withPassword) {
    if (await bcrypt.compare(password, a.admin.password_hash)) { match = a; break }
  }
  if (!match) {
    auditLog({ user_type: 'admin', action: 'login_failed', extra: { email }, ip_address: req.ip })
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const { admin, tenantId, slug } = match

  if (admin.totp_enabled) {
    const partial_token = signPartialToken(admin.id, tenantId)
    return res.json({ requires_2fa: true, partial_token })
  }

  auditLog({ user_type: 'admin', user_id: admin.id, action: 'login', ip_address: req.ip })
  const token = signAdminToken(admin.id, admin.email, tenantId, admin.role || 'owner')
  res.json({ token, slug, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role || 'owner', tenantId } })
})

router.get('/me', requireAdmin, async (req: any, res: Response) => {
  const { rows } = await query('SELECT id, name, email, role, created_at FROM admin_users WHERE id = $1', [req.adminId])
  res.json(rows[0])
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  // One link per account (an email can be an admin in several companies).
  // Tokens live in public.password_reset_tokens with tenant_id (NULL = legacy
  // public admin), the same scheme the guard reset uses.
  const accounts = (await findAdminAccounts(email)).filter(a => a.admin.password_hash)
  for (const { admin, tenantId } of accounts) {
    const token      = crypto.randomBytes(32).toString('hex')
    const tokenHash  = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt  = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await pool.query(
      `UPDATE public.password_reset_tokens SET used = 1
       WHERE user_type = 'admin' AND user_id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
      [admin.id, tenantId]
    )
    await pool.query(
      `INSERT INTO public.password_reset_tokens (user_type, user_id, tenant_id, token, expires_at) VALUES ('admin', $1, $2, $3, $4)`,
      [admin.id, tenantId, tokenHash, expiresAt.toISOString()]
    )
    await sendPasswordReset(admin.email, token, 'admin')
  }
  // Always the same answer, to prevent email enumeration
  res.json({ message: 'If that email is registered, a reset link has been sent.' })
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, new_password } = req.body
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' })
  if (new_password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' })

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  // Claim the token in one statement so it can only ever be used once
  const { rows } = await pool.query(`
    UPDATE public.password_reset_tokens SET used = 1
    WHERE token = $1 AND user_type = 'admin' AND used = 0 AND expires_at > NOW()
    RETURNING user_id, tenant_id
  `, [tokenHash])
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' })

  const table = rows[0].tenant_id ? `tenant_${Number(rows[0].tenant_id)}.admin_users` : 'public.admin_users'
  const hash = await bcrypt.hash(new_password, 10)
  await pool.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [hash, rows[0].user_id])
  auditLog({ user_type: 'admin', user_id: rows[0].user_id, action: 'password_reset', extra: { tenant_id: rows[0].tenant_id }, ip_address: req.ip })
  res.json({ message: 'Password updated successfully' })
})

// ── 2FA — validate TOTP after password login ─────────────────────────────────

router.post('/2fa/validate', async (req: Request, res: Response) => {
  const { partial_token, code } = req.body
  if (!partial_token || !code) return res.status(400).json({ error: 'partial_token and code required' })

  let payload: any
  try {
    payload = jwt.verify(partial_token, JWT_SECRET) as any
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session — please log in again' })
  }
  if (!payload.twofa_pending) return res.status(401).json({ error: 'Invalid token type' })

  const { rows } = await query('SELECT * FROM admin_users WHERE id = $1', [payload.adminId])
  const admin = rows[0]
  if (!admin) return res.status(401).json({ error: 'Account not found' })

  // Check TOTP code
  const totpValid = admin.totp_secret && totp.verify(code.replace(/\s/g, ''), admin.totp_secret)

  // Check backup codes if TOTP fails
  if (!totpValid) {
    const backupCodes: string[] = admin.totp_backup_codes ? JSON.parse(admin.totp_backup_codes) : []
    const codeHash = crypto.createHash('sha256').update(code.replace(/\s/g, '').toUpperCase()).digest('hex')
    const idx = backupCodes.indexOf(codeHash)
    if (idx === -1) {
      auditLog({ user_type: 'admin', action: '2fa_failed', user_id: admin.id, ip_address: req.ip })
      return res.status(401).json({ error: 'Invalid authentication code' })
    }
    // Consume backup code (one-time use)
    backupCodes.splice(idx, 1)
    await query('UPDATE admin_users SET totp_backup_codes = $1 WHERE id = $2', [JSON.stringify(backupCodes), admin.id])
    auditLog({ user_type: 'admin', user_id: admin.id, action: '2fa_backup_used', ip_address: req.ip })
  }

  auditLog({ user_type: 'admin', user_id: admin.id, action: 'login', ip_address: req.ip })
  let twoFaSlug: string | null = null
  if (payload.tenantId) {
    const { rows: slugRows } = await pool.query('SELECT slug FROM public.tenants WHERE id = $1', [payload.tenantId])
    if (slugRows[0]) twoFaSlug = slugRows[0].slug
  }
  const token = signAdminToken(admin.id, admin.email, payload.tenantId ?? null, admin.role || 'owner')
  res.json({ token, slug: twoFaSlug, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role || 'owner', tenantId: payload.tenantId ?? null } })
})

// ── 2FA — management (requires full admin auth) ───────────────────────────────

router.get('/2fa/status', requireAdmin, async (req: any, res: Response) => {
  const { rows } = await query('SELECT totp_enabled FROM admin_users WHERE id = $1', [req.adminId])
  res.json({ enabled: !!rows[0]?.totp_enabled })
})

router.post('/2fa/setup', requireAdmin, async (req: any, res: Response) => {
  const { rows } = await query('SELECT email, totp_enabled FROM admin_users WHERE id = $1', [req.adminId])
  const admin = rows[0]
  if (!admin) return res.status(404).json({ error: 'Account not found' })
  if (admin.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' })

  const secret = totp.generateSecret()
  // Store secret temporarily (not yet active until confirmed)
  await query('UPDATE admin_users SET totp_secret = $1 WHERE id = $2', [secret, req.adminId])

  const otpauth = totp.keyuri(admin.email, 'Strondis Ops', secret)
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 256, margin: 2 })

  res.json({ secret, qr_code: qrDataUrl })
})

router.post('/2fa/confirm', requireAdmin, async (req: any, res: Response) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Verification code required' })

  const { rows } = await query('SELECT totp_secret, totp_enabled FROM admin_users WHERE id = $1', [req.adminId])
  const admin = rows[0]
  if (!admin?.totp_secret) return res.status(400).json({ error: 'Start 2FA setup first' })
  if (admin.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' })

  const valid = totp.verify(code.replace(/\s/g, ''), admin.totp_secret)
  if (!valid) return res.status(400).json({ error: 'Invalid code — check your authenticator app' })

  const { plain, hashed } = generateBackupCodes()
  await query(
    'UPDATE admin_users SET totp_enabled = 1, totp_backup_codes = $1 WHERE id = $2',
    [JSON.stringify(hashed), req.adminId]
  )
  auditLog({ user_type: 'admin', user_id: req.adminId, action: '2fa_enabled', ip_address: req.ip })

  res.json({ backup_codes: plain })
})

router.post('/2fa/disable', requireAdmin, async (req: any, res: Response) => {
  const { password, code } = req.body
  if (!password || !code) return res.status(400).json({ error: 'Password and authenticator code required' })

  const { rows } = await query('SELECT * FROM admin_users WHERE id = $1', [req.adminId])
  const admin = rows[0]
  if (!admin) return res.status(404).json({ error: 'Account not found' })
  if (!admin.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' })

  if (admin.password_hash) {
    const pwValid = await bcrypt.compare(password, admin.password_hash)
    if (!pwValid) return res.status(401).json({ error: 'Incorrect password' })
  }

  const totpValid = totp.verify(code.replace(/\s/g, ''), admin.totp_secret)
  if (!totpValid) return res.status(400).json({ error: 'Invalid authenticator code' })

  await query(
    'UPDATE admin_users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = $1',
    [req.adminId]
  )
  auditLog({ user_type: 'admin', user_id: req.adminId, action: '2fa_disabled', ip_address: req.ip })
  res.json({ message: '2FA has been disabled' })
})

router.post('/2fa/backup-codes/regenerate', requireAdmin, async (req: any, res: Response) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Authenticator code required' })

  const { rows } = await query('SELECT totp_secret, totp_enabled FROM admin_users WHERE id = $1', [req.adminId])
  const admin = rows[0]
  if (!admin?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' })

  const valid = totp.verify(code.replace(/\s/g, ''), admin.totp_secret)
  if (!valid) return res.status(400).json({ error: 'Invalid authenticator code' })

  const { plain, hashed } = generateBackupCodes()
  await query('UPDATE admin_users SET totp_backup_codes = $1 WHERE id = $2', [JSON.stringify(hashed), req.adminId])
  auditLog({ user_type: 'admin', user_id: req.adminId, action: '2fa_backup_regenerated', ip_address: req.ip })

  res.json({ backup_codes: plain })
})

// ── SSO config probe ──────────────────────────────────────────────────────────
// Frontend calls this to know which SSO buttons to show
router.get('/sso-config', (_req: Request, res: Response) => {
  res.json({
    google:    !!(process.env.GOOGLE_CLIENT_ID    && process.env.GOOGLE_REDIRECT_URI),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_REDIRECT_URI),
  })
})

// ── OAuth helpers ─────────────────────────────────────────────────────────────

// Short-lived CSRF state tokens — in-memory, expires 10 minutes
const oauthStates = new Map<string, number>() // state → createdAt ms

function newState(): string {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of oauthStates) { if (v < cutoff) oauthStates.delete(k) }
  const state = crypto.randomBytes(24).toString('hex')
  oauthStates.set(state, Date.now())
  return state
}

function consumeState(state: string): boolean {
  if (!oauthStates.has(state)) return false
  oauthStates.delete(state)
  return true
}

// POST to an OAuth token endpoint (application/x-www-form-urlencoded)
async function oauthPost(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams(body).toString(),
  })
  const data = await res.json() as any
  if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`)
  return data
}

// GET from an OAuth resource endpoint
async function oauthGet(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json()
}

// Find an existing admin by OAuth identity or email, optionally auto-provision
async function findOrProvisionAdmin(opts: {
  email: string; name: string; provider: string; subject: string
}) {
  const { email, name, provider, subject } = opts

  // Already linked via OAuth subject
  const { rows: bySubject } = await query(
    'SELECT * FROM admin_users WHERE oauth_provider = $1 AND oauth_subject = $2',
    [provider, subject]
  )
  if (bySubject[0]) return bySubject[0]

  // Existing account with matching email — link it
  const { rows: byEmail } = await query('SELECT * FROM admin_users WHERE email = $1', [email])
  if (byEmail[0]) {
    await query(
      'UPDATE admin_users SET oauth_provider = $1, oauth_subject = $2 WHERE id = $3',
      [provider, subject, byEmail[0].id]
    )
    return byEmail[0]
  }

  // Auto-provision: only if OAUTH_AUTO_PROVISION=true (off by default)
  if (process.env.OAUTH_AUTO_PROVISION === 'true') {
    const { rows } = await query(
      'INSERT INTO admin_users (name, email, oauth_provider, oauth_subject) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, provider, subject]
    )
    console.log(`[OAuth] Auto-provisioned admin: ${email} (${provider})`)
    return rows[0]
  }

  return null
}

// Redirect URL on OAuth error — always goes back to the frontend login page
function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
}
function redirectError(res: Response, msg: string) {
  return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent(msg)}`)
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response) => {
  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) return redirectError(res, 'Google SSO is not configured on this server')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state:         newState(),
    access_type:   'online',
    prompt:        'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string }

  if (!state || !consumeState(state)) return redirectError(res, 'Invalid OAuth state — please try again')
  if (!code) return redirectError(res, 'No authorisation code received from Google')

  try {
    const tokenData = await oauthPost('https://oauth2.googleapis.com/token', {
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    'authorization_code',
    })
    if (!tokenData.access_token) return redirectError(res, 'Google did not return an access token')

    const userInfo = await oauthGet('https://www.googleapis.com/oauth2/v3/userinfo', tokenData.access_token)
    if (!userInfo.email) return redirectError(res, 'Could not retrieve email from Google account')

    const admin = await findOrProvisionAdmin({
      email:    userInfo.email,
      name:     userInfo.name || userInfo.email,
      provider: 'google',
      subject:  userInfo.sub,
    })
    if (!admin) return redirectError(res, 'No admin account is linked to this Google address. Ask your administrator to create one.')

    auditLog({ user_type: 'admin', user_id: admin.id, action: 'oauth_login', extra: { provider: 'google' }, ip_address: req.ip })
    const token = signAdminToken(admin.id, admin.email)
    const user  = encodeURIComponent(JSON.stringify({ id: admin.id, name: admin.name, email: admin.email }))
    res.redirect(`${frontendUrl()}/login?token=${token}&user=${user}`)
  } catch (e: any) {
    console.error('[Google OAuth]', e.message)
    redirectError(res, 'Google sign-in failed — please try again')
  }
})

// ── Microsoft OAuth ───────────────────────────────────────────────────────────

router.get('/microsoft', (req: Request, res: Response) => {
  const clientId    = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI
  if (!clientId || !redirectUri) return redirectError(res, 'Microsoft SSO is not configured on this server')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile User.Read',
    state:         newState(),
    response_mode: 'query',
    prompt:        'select_account',
  })
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
})

router.get('/microsoft/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string }

  if (!state || !consumeState(state)) return redirectError(res, 'Invalid OAuth state — please try again')
  if (!code) return redirectError(res, 'No authorisation code received from Microsoft')

  try {
    const tokenData = await oauthPost('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      code,
      client_id:     process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri:  process.env.MICROSOFT_REDIRECT_URI!,
      grant_type:    'authorization_code',
      scope:         'openid email profile User.Read',
    })
    if (!tokenData.access_token) return redirectError(res, 'Microsoft did not return an access token')

    const userInfo = await oauthGet(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',
      tokenData.access_token
    )
    const email = userInfo.mail || userInfo.userPrincipalName
    if (!email) return redirectError(res, 'Could not retrieve email from Microsoft account')

    const admin = await findOrProvisionAdmin({
      email,
      name:     userInfo.displayName || email,
      provider: 'microsoft',
      subject:  userInfo.id,
    })
    if (!admin) return redirectError(res, 'No admin account is linked to this Microsoft address. Ask your administrator to create one.')

    auditLog({ user_type: 'admin', user_id: admin.id, action: 'oauth_login', extra: { provider: 'microsoft' }, ip_address: req.ip })
    const token = signAdminToken(admin.id, admin.email)
    const user  = encodeURIComponent(JSON.stringify({ id: admin.id, name: admin.name, email: admin.email }))
    res.redirect(`${frontendUrl()}/login?token=${token}&user=${user}`)
  } catch (e: any) {
    console.error('[Microsoft OAuth]', e.message)
    redirectError(res, 'Microsoft sign-in failed — please try again')
  }
})

export default router
