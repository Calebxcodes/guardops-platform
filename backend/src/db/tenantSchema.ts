import { pool } from './pool'

/**
 * Provisions a fresh PostgreSQL schema for a new tenant.
 * Mirrors the table structure from schema.ts but scoped to tenant_N.
 * Called once per tenant at signup time.
 */
export async function initTenantSchema(tenantId: number): Promise<void> {
  const schemaName = `tenant_${tenantId}`
  const client = await pool.connect()

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`)
    await client.query(`SET search_path TO ${schemaName}, public`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id                      SERIAL PRIMARY KEY,
        name                    TEXT NOT NULL DEFAULT '',
        email                   TEXT UNIQUE NOT NULL,
        password_hash           TEXT,
        role                    TEXT NOT NULL DEFAULT 'owner',
        oauth_provider          TEXT,
        oauth_subject           TEXT,
        totp_secret             TEXT,
        totp_enabled            INTEGER DEFAULT 0,
        totp_backup_codes       TEXT,
        invitation_token        TEXT,
        invitation_expires_at   BIGINT,
        invitation_accepted     INTEGER DEFAULT 0,
        created_at              TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS role_policies (
        id         SERIAL PRIMARY KEY,
        role       TEXT NOT NULL,
        feature    TEXT NOT NULL,
        action     TEXT NOT NULL,
        allowed    INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS guards (
        id               SERIAL PRIMARY KEY,
        first_name       TEXT NOT NULL,
        last_name        TEXT NOT NULL,
        email            TEXT UNIQUE,
        phone            TEXT,
        address          TEXT,
        date_of_birth    TEXT,
        employment_type  TEXT DEFAULT 'full-time',
        status           TEXT DEFAULT 'off-duty',
        hourly_rate      REAL DEFAULT 15,
        certifications   TEXT DEFAULT '[]',
        skills           TEXT DEFAULT '[]',
        bank_account     TEXT,
        bank_routing     TEXT,
        notes            TEXT,
        avatar_url       TEXT,
        face_descriptor  TEXT,
        active           INTEGER DEFAULT 1,
        deleted_at       TIMESTAMPTZ,
        break_start_time TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS guard_auth (
        id           SERIAL PRIMARY KEY,
        guard_id     INTEGER UNIQUE REFERENCES guards(id),
        password_hash TEXT NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clients (
        id             SERIAL PRIMARY KEY,
        name           TEXT NOT NULL,
        contact_name   TEXT,
        contact_email  TEXT,
        contact_phone  TEXT,
        address        TEXT,
        notes          TEXT,
        active         INTEGER DEFAULT 1,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sites (
        id               SERIAL PRIMARY KEY,
        client_id        INTEGER REFERENCES clients(id),
        name             TEXT NOT NULL,
        address          TEXT,
        lat              REAL,
        lng              REAL,
        requirements     TEXT,
        post_orders      TEXT,
        guards_required  INTEGER DEFAULT 1,
        hourly_rate      REAL DEFAULT 0,
        guard_hourly_rate REAL DEFAULT 0,
        geofence_radius  INTEGER DEFAULT 183,
        active           INTEGER DEFAULT 1,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id               SERIAL PRIMARY KEY,
        site_id          INTEGER REFERENCES sites(id),
        guard_id         INTEGER REFERENCES guards(id),
        start_time       TIMESTAMPTZ NOT NULL,
        end_time         TIMESTAMPTZ NOT NULL,
        status           TEXT DEFAULT 'unassigned',
        hourly_rate      REAL,
        break_minutes    INTEGER DEFAULT 30,
        notes            TEXT,
        auto_clocked_out INTEGER DEFAULT 0,
        actual_end_time  TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clock_events (
        id            SERIAL PRIMARY KEY,
        guard_id      INTEGER REFERENCES guards(id),
        shift_id      INTEGER REFERENCES shifts(id),
        type          TEXT NOT NULL,
        lat           REAL,
        lng           REAL,
        accuracy      REAL,
        photo_url     TEXT,
        notes         TEXT,
        face_verified INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS route_checkpoints (
        id           SERIAL PRIMARY KEY,
        site_id      INTEGER REFERENCES sites(id),
        name         TEXT NOT NULL,
        lat          REAL,
        lng          REAL,
        order_num    INTEGER DEFAULT 0,
        instructions TEXT
      );

      CREATE TABLE IF NOT EXISTS checkpoint_checkins (
        id             SERIAL PRIMARY KEY,
        checkpoint_id  INTEGER REFERENCES route_checkpoints(id),
        guard_id       INTEGER REFERENCES guards(id),
        shift_id       INTEGER REFERENCES shifts(id),
        lat            REAL,
        lng            REAL,
        photo_url      TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id            SERIAL PRIMARY KEY,
        from_guard_id INTEGER REFERENCES guards(id),
        to_guard_id   INTEGER,
        is_emergency  INTEGER DEFAULT 0,
        body          TEXT NOT NULL,
        read_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS timesheets (
        id             SERIAL PRIMARY KEY,
        guard_id       INTEGER REFERENCES guards(id),
        shift_id       INTEGER REFERENCES shifts(id),
        period_start   TEXT NOT NULL,
        period_end     TEXT NOT NULL,
        regular_hours  REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        total_hours    REAL DEFAULT 0,
        status         TEXT DEFAULT 'draft',
        source         TEXT DEFAULT 'manual',
        manager_notes  TEXT,
        guard_notes    TEXT,
        submitted_at   TIMESTAMPTZ,
        approved_at    TIMESTAMPTZ,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payroll_records (
        id             SERIAL PRIMARY KEY,
        guard_id       INTEGER REFERENCES guards(id),
        period_start   TEXT NOT NULL,
        period_end     TEXT NOT NULL,
        regular_hours  REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        regular_pay    REAL DEFAULT 0,
        overtime_pay   REAL DEFAULT 0,
        bonuses        REAL DEFAULT 0,
        deductions     REAL DEFAULT 0,
        gross_pay      REAL DEFAULT 0,
        net_pay        REAL DEFAULT 0,
        status         TEXT DEFAULT 'pending',
        processed_at   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id          SERIAL PRIMARY KEY,
        site_id     INTEGER REFERENCES sites(id),
        guard_id    INTEGER REFERENCES guards(id),
        shift_id    INTEGER REFERENCES shifts(id),
        type        TEXT NOT NULL,
        severity    TEXT DEFAULT 'minor',
        description TEXT,
        ai_report   TEXT,
        bodycam     INTEGER DEFAULT 0,
        resolved    INTEGER DEFAULT 0,
        resolved_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS client_portal_tokens (
        id           SERIAL PRIMARY KEY,
        client_id    INTEGER REFERENCES clients(id),
        token        TEXT UNIQUE NOT NULL,
        token_prefix VARCHAR(16),
        label        TEXT,
        active       INTEGER DEFAULT 1,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL PRIMARY KEY,
        user_type  TEXT NOT NULL,
        user_id    INTEGER NOT NULL,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used       INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shift_checks (
        id              SERIAL PRIMARY KEY,
        guard_id        INTEGER REFERENCES guards(id),
        shift_id        INTEGER REFERENCES shifts(id),
        checked_at      TIMESTAMPTZ DEFAULT NOW(),
        headcount       INTEGER DEFAULT 0,
        fire_exits_clear INTEGER DEFAULT 0,
        toilets_ok      INTEGER DEFAULT 0,
        lighting_ok     INTEGER DEFAULT 0,
        notes           TEXT
      );

      CREATE TABLE IF NOT EXISTS checklist_templates (
        id          SERIAL PRIMARY KEY,
        site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        label       TEXT NOT NULL,
        description TEXT,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shift_check_items (
        id          SERIAL PRIMARY KEY,
        check_id    INTEGER NOT NULL REFERENCES shift_checks(id) ON DELETE CASCADE,
        template_id INTEGER REFERENCES checklist_templates(id) ON DELETE SET NULL,
        label       TEXT NOT NULL,
        checked     INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS documents (
        id               SERIAL PRIMARY KEY,
        name             TEXT NOT NULL,
        original_name    TEXT NOT NULL,
        category         TEXT NOT NULL DEFAULT 'general',
        site_id          INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        uploaded_by      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        file_path        TEXT NOT NULL,
        mime_type        TEXT,
        size             INTEGER DEFAULT 0,
        description      TEXT,
        is_guard_visible INTEGER NOT NULL DEFAULT 1,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS audit_log (
        id            SERIAL PRIMARY KEY,
        user_type     TEXT NOT NULL,
        user_id       INTEGER,
        action        TEXT NOT NULL,
        resource_type TEXT,
        resource_id   INTEGER,
        ip_address    TEXT,
        extra         TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        key    TEXT NOT NULL,
        hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS time_off_types (
        id                SERIAL PRIMARY KEY,
        name              TEXT NOT NULL,
        paid              INTEGER DEFAULT 1,
        max_days_per_year INTEGER,
        requires_approval INTEGER DEFAULT 1,
        active            INTEGER DEFAULT 1,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS time_off_requests (
        id          SERIAL PRIMARY KEY,
        guard_id    INTEGER REFERENCES guards(id),
        type_id     INTEGER REFERENCES time_off_types(id),
        start_date  DATE NOT NULL,
        end_date    DATE NOT NULL,
        days        REAL NOT NULL DEFAULT 1,
        reason      TEXT,
        status      TEXT DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES admin_users(id),
        review_note TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_time_off_requests_guard  ON time_off_requests (guard_id);
      CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON time_off_requests (status);

      CREATE TABLE IF NOT EXISTS security_badges (
        id                   SERIAL PRIMARY KEY,
        guard_id             INTEGER REFERENCES guards(id) ON DELETE CASCADE,
        sia_license_number   VARCHAR(50),
        sia_expiry_date      DATE,
        badge_number         VARCHAR(100),
        card_type            VARCHAR(100),
        photo_url            TEXT,
        is_current           INTEGER DEFAULT 1,
        status               TEXT DEFAULT 'verified',
        reviewed_by_guard_at BIGINT,
        created_at           TIMESTAMPTZ DEFAULT NOW(),
        archived_at          TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_security_badges_guard   ON security_badges (guard_id);
      CREATE INDEX IF NOT EXISTS idx_security_badges_current ON security_badges (guard_id, is_current);

      CREATE TABLE IF NOT EXISTS tax_documents (
        id            SERIAL PRIMARY KEY,
        guard_id      INTEGER REFERENCES guards(id) ON DELETE CASCADE,
        document_type TEXT,
        file_name     TEXT,
        file_url      TEXT,
        uploaded_by   TEXT DEFAULT 'guard',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tax_documents_guard ON tax_documents (guard_id);
    `)

    await client.query(`
      INSERT INTO time_off_types (name, paid, requires_approval)
      SELECT name, paid, 1
      FROM (VALUES ('Annual Leave', 1), ('Sick Leave', 1), ('Personal Leave', 1), ('Unpaid Leave', 0)) AS d(name, paid)
      WHERE NOT EXISTS (SELECT 1 FROM time_off_types)
    `)

    // Schema migrations — idempotent column additions for existing tenants
    await client.query(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS guard_hourly_rate REAL DEFAULT 0
    `)

    await client.query(`SET search_path TO public`)
    console.log(`[Tenant Schema] Initialized ${schemaName}`)
  } finally {
    client.release()
  }
}
