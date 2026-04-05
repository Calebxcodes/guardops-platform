import { Pool } from 'pg'

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
  `)
}
