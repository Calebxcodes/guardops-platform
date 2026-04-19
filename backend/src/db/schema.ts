import { Pool } from 'pg'
import crypto from 'crypto'

// Railway internal network is secure; only use SSL for external managed DB URLs
const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
})

export async function query(text: string, params?: any[]) {
  return pool.query(text, params)
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      name TEXT NOT NULL,
      address TEXT,
      lat REAL,
      lng REAL,
      requirements TEXT,
      post_orders TEXT,
      guards_required INTEGER DEFAULT 1,
      hourly_rate REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guards (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      address TEXT,
      date_of_birth TEXT,
      employment_type TEXT DEFAULT 'full-time',
      status TEXT DEFAULT 'off-duty',
      hourly_rate REAL DEFAULT 15,
      certifications TEXT DEFAULT '[]',
      skills TEXT DEFAULT '[]',
      bank_account TEXT,
      bank_routing TEXT,
      notes TEXT,
      avatar_url TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guard_auth (
      id SERIAL PRIMARY KEY,
      guard_id INTEGER UNIQUE REFERENCES guards(id),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id),
      guard_id INTEGER REFERENCES guards(id),
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'unassigned',
      hourly_rate REAL,
      break_minutes INTEGER DEFAULT 30,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clock_events (
      id SERIAL PRIMARY KEY,
      guard_id INTEGER REFERENCES guards(id),
      shift_id INTEGER REFERENCES shifts(id),
      type TEXT NOT NULL,
      lat REAL,
      lng REAL,
      accuracy REAL,
      photo_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS route_checkpoints (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id),
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      order_num INTEGER DEFAULT 0,
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS checkpoint_checkins (
      id SERIAL PRIMARY KEY,
      checkpoint_id INTEGER REFERENCES route_checkpoints(id),
      guard_id INTEGER REFERENCES guards(id),
      shift_id INTEGER REFERENCES shifts(id),
      lat REAL,
      lng REAL,
      photo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      from_guard_id INTEGER REFERENCES guards(id),
      to_guard_id INTEGER,
      is_emergency INTEGER DEFAULT 0,
      body TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS timesheets (
      id SERIAL PRIMARY KEY,
      guard_id INTEGER REFERENCES guards(id),
      shift_id INTEGER REFERENCES shifts(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      regular_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      total_hours REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      source TEXT DEFAULT 'manual',
      manager_notes TEXT,
      guard_notes TEXT,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id SERIAL PRIMARY KEY,
      guard_id INTEGER REFERENCES guards(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      regular_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      regular_pay REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      bonuses REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      gross_pay REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id),
      guard_id INTEGER REFERENCES guards(id),
      shift_id INTEGER REFERENCES shifts(id),
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'minor',
      description TEXT,
      ai_report TEXT,
      bodycam INTEGER DEFAULT 0,
      resolved INTEGER DEFAULT 0,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // Non-destructive column additions for existing tables
  await pool.query(`
    ALTER TABLE guards ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
    ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS face_verified INTEGER DEFAULT 0;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS geofence_radius INTEGER DEFAULT 183;
  `)

  // Hourly site checks table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_checks (
      id SERIAL PRIMARY KEY,
      guard_id INTEGER REFERENCES guards(id),
      shift_id INTEGER REFERENCES shifts(id),
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      headcount INTEGER DEFAULT 0,
      fire_exits_clear INTEGER DEFAULT 0,
      toilets_ok INTEGER DEFAULT 0,
      lighting_ok INTEGER DEFAULT 0,
      notes TEXT
    );
  `)

  // Flexible checklist templates per site
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id         SERIAL PRIMARY KEY,
      site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS shift_check_items (
      id          SERIAL PRIMARY KEY,
      check_id    INTEGER NOT NULL REFERENCES shift_checks(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES checklist_templates(id) ON DELETE SET NULL,
      label       TEXT NOT NULL,
      checked     INTEGER NOT NULL DEFAULT 0
    );
  `)

  // Document management
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      original_name TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'general',
      site_id       INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      uploaded_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
      file_path     TEXT NOT NULL,
      mime_type     TEXT,
      size          INTEGER DEFAULT 0,
      description   TEXT,
      is_guard_visible INTEGER NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS documents_category_idx ON documents (category);
    CREATE INDEX IF NOT EXISTS documents_site_idx     ON documents (site_id);
  `)

  // Push notification subscriptions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      guard_id   INTEGER NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (guard_id, endpoint)
    );
    CREATE INDEX IF NOT EXISTS push_subs_guard_idx ON push_subscriptions (guard_id);
  `)

  // Portal token hashing migration — adds token_prefix and hashes any existing raw tokens
  await pool.query(`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS token_prefix VARCHAR(16);`)
  const { rows: rawTokens } = await pool.query(
    `SELECT id, token FROM client_portal_tokens WHERE token_prefix IS NULL AND length(token) = 64`
  )
  if (rawTokens.length > 0) {
    for (const row of rawTokens) {
      const hash = crypto.createHash('sha256').update(row.token).digest('hex')
      const prefix = (row.token as string).slice(0, 12)
      await pool.query(
        `UPDATE client_portal_tokens SET token = $1, token_prefix = $2 WHERE id = $3`,
        [hash, prefix, row.id]
      )
    }
    console.log(`[Migration] Hashed ${rawTokens.length} portal token(s)`)
  }

  // Rate limit hits — shared across all instances
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_hits (
      key        TEXT NOT NULL,
      hit_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS rate_limit_hits_key_idx ON rate_limit_hits (key, hit_at);
  `)

  // Audit log — immutable record of security-sensitive events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_type TEXT NOT NULL,          -- 'admin' | 'guard' | 'system'
      user_id   INTEGER,
      action    TEXT NOT NULL,          -- e.g. 'login', 'clock_in', 'face_enrol'
      resource_type TEXT,               -- e.g. 'shift', 'guard'
      resource_id   INTEGER,
      ip_address    TEXT,
      extra         TEXT,               -- JSON string for any additional context
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_log_user_idx    ON audit_log (user_type, user_id);
    CREATE INDEX IF NOT EXISTS audit_log_action_idx  ON audit_log (action);
    CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
  `)

  // ── Performance indexes ────────────────────────────────────────────────────
  // These cover the most frequent query patterns across all routes.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS shifts_guard_idx       ON shifts (guard_id);
    CREATE INDEX IF NOT EXISTS shifts_site_idx        ON shifts (site_id);
    CREATE INDEX IF NOT EXISTS shifts_status_idx      ON shifts (status);
    CREATE INDEX IF NOT EXISTS shifts_start_time_idx  ON shifts (start_time);
    CREATE INDEX IF NOT EXISTS shifts_guard_status_idx ON shifts (guard_id, status);

    CREATE INDEX IF NOT EXISTS timesheets_guard_idx   ON timesheets (guard_id);
    CREATE INDEX IF NOT EXISTS timesheets_status_idx  ON timesheets (status);
    CREATE INDEX IF NOT EXISTS timesheets_shift_idx   ON timesheets (shift_id);

    CREATE INDEX IF NOT EXISTS incidents_site_idx     ON incidents (site_id);
    CREATE INDEX IF NOT EXISTS incidents_guard_idx    ON incidents (guard_id);
    CREATE INDEX IF NOT EXISTS incidents_resolved_idx ON incidents (resolved);
    CREATE INDEX IF NOT EXISTS incidents_created_idx  ON incidents (created_at DESC);

    CREATE INDEX IF NOT EXISTS payroll_guard_idx      ON payroll_records (guard_id);
    CREATE INDEX IF NOT EXISTS payroll_period_idx     ON payroll_records (period_start, period_end);

    CREATE INDEX IF NOT EXISTS messages_from_guard_idx ON messages (from_guard_id);
    CREATE INDEX IF NOT EXISTS messages_read_at_idx    ON messages (read_at);

    CREATE INDEX IF NOT EXISTS clock_events_shift_idx   ON clock_events (shift_id);
    CREATE INDEX IF NOT EXISTS shift_checks_shift_idx   ON shift_checks (shift_id);
  `)

  // checkpoint_scans may not exist in older deployments — create index only if table exists
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS checkpoint_scans_shift_idx ON checkpoint_scans (shift_id)`)
  } catch { /* table not yet created — skip */ }

  // OAuth SSO columns — added as a migration so existing deployments upgrade in place
  await pool.query(`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS oauth_subject  TEXT;
  `)
  // password_hash is nullable for OAuth-only accounts (no password set)
  await pool.query(`ALTER TABLE admin_users ALTER COLUMN password_hash DROP NOT NULL`)

  // 2FA (TOTP) columns
  await pool.query(`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret       TEXT;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled      INTEGER DEFAULT 0;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT;
  `)
}

// ── Shared rate-limit store (PostgreSQL) ─────────────────────────────────────
// Replaces in-memory store so limits are enforced across all Railway instances.
export class PgRateLimitStore {
  private windowMs: number
  constructor(windowMs: number) { this.windowMs = windowMs }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const windowStart = new Date(Date.now() - this.windowMs)
    // Remove stale hits for this key (keep window clean)
    await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1 AND hit_at < $2`, [key, windowStart])
    // Record this hit
    await pool.query(`INSERT INTO rate_limit_hits (key) VALUES ($1)`, [key])
    // Count hits in current window
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as total, MIN(hit_at) as oldest FROM rate_limit_hits WHERE key = $1`,
      [key]
    )
    const total = rows[0].total as number
    const oldest: Date = rows[0].oldest ? new Date(rows[0].oldest) : new Date()
    const resetTime = new Date(oldest.getTime() + this.windowMs)
    return { totalHits: total, resetTime }
  }

  async decrement(key: string): Promise<void> {
    await pool.query(
      `DELETE FROM rate_limit_hits WHERE ctid = (SELECT ctid FROM rate_limit_hits WHERE key = $1 ORDER BY hit_at DESC LIMIT 1)`,
      [key]
    )
  }

  async resetKey(key: string): Promise<void> {
    await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [key])
  }
}

// ── Audit helper ──────────────────────────────────────────────────────────────
// Fire-and-forget: never throws — audit failure must never break the main flow.
export function auditLog(params: {
  user_type: 'admin' | 'guard' | 'system'
  user_id?: number
  action: string
  resource_type?: string
  resource_id?: number
  ip_address?: string
  extra?: Record<string, unknown>
}) {
  pool.query(
    `INSERT INTO audit_log (user_type, user_id, action, resource_type, resource_id, ip_address, extra)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      params.user_type,
      params.user_id ?? null,
      params.action,
      params.resource_type ?? null,
      params.resource_id ?? null,
      params.ip_address ?? null,
      params.extra ? JSON.stringify(params.extra) : null,
    ]
  ).catch(err => console.error('[audit] write failed:', err.message))
}
