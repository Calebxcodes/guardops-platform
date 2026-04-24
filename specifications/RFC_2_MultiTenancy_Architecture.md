# RFC #2: MULTI-TENANCY ARCHITECTURE

**Title:** Schema-Based Multi-Tenant Database Isolation  
**Status:** Approved  
**Last Updated:** April 21, 2026  
**Owner:** Strondis Engineering Team

---

## ABSTRACT

This RFC documents the multi-tenancy architecture for Strondis:

1. **One PostgreSQL instance** with one database, multiple schemas (one per tenant)
2. **Tenant detection** via request hostname (subdomain routing)
3. **Automatic schema provisioning** on tenant signup
4. **Row-level security** via PostgreSQL roles
5. **Data isolation guarantees** (schema breach ≠ all data exposed)

---

## DECISION: SCHEMA-BASED vs. SEPARATE DATABASES

### Option A: PostgreSQL Schemas (One Database, Multiple Schemas) — CHOSEN

**Architecture:**
```
PostgreSQL Instance (guardops-db on Railway)
├── Database: postgres (single database)
│   ├── Schema: public (metadata shared by backend)
│   │   ├── tenants
│   │   ├── subscriptions
│   │   ├── payments
│   │   ├── master_admins
│   │   └── audit_logs
│   │
│   ├── Schema: tenant_1 (Company A's data)
│   │   ├── guards
│   │   ├── shifts
│   │   ├── incidents
│   │   └── ...
│   │
│   ├── Schema: tenant_2 (Company B's data)
│   │   ├── guards
│   │   ├── shifts
│   │   └── ...
│   │
│   └── Schema: tenant_N (Company N)
│       └── ...
```

**How it works:**
1. Client requests: `allied-security.strondis.com/api/guards`
2. Backend detects tenant slug → looks up `tenant_id = 1` from `public.tenants`
3. Backend sets `SET search_path TO tenant_1, public;`
4. Query `SELECT * FROM guards;` runs against `tenant_1.guards` (not another tenant's)

**Pros:**
- ✅ **Cost:** One PostgreSQL bill, not N
- ✅ **Backup/Restore:** Single database backup contains all tenants
- ✅ **Simplicity:** Single connection string, same credentials
- ✅ **Scalability:** Add new tenant with `CREATE SCHEMA tenant_NNN` (takes milliseconds)
- ✅ **Security:** PostgreSQL roles enforce per-schema permissions
- ✅ **Compliance:** Data naturally segregated per schema
- ✅ **Monitoring:** Single database to monitor/index/optimize

**Cons:**
- ❌ **Shared infrastructure:** One bad query can affect all tenants
- ❌ **One database failure:** All tenants down (mitigated by Railway redundancy)
- ❌ **Shared backups:** One corrupt backup affects all (mitigated by versioning)

### Option B: Separate PostgreSQL Databases

**Setup:**
- One PostgreSQL instance with 100+ databases (one per tenant)
- Each tenant has unique `DATABASE_URL`
- Connect to appropriate database based on tenant

**Pros:**
- ✅ Total isolation (database-level)
- ✅ Independent backups per tenant
- ✅ Can take down one tenant without affecting others

**Cons:**
- ❌ **Cost:** 100 tenants = 100 separate database bills
- ❌ **Complexity:** Connection pooling nightmare (N connection pools)
- ❌ **Operational overhead:** 100 separate backup/restore jobs
- ❌ **Not standard:** Most SaaS platforms use schemas, not separate databases
- ❌ **Slower provisioning:** Creating a database takes seconds; creating a schema takes milliseconds

### Option C: Row-Level Security (Single Schema, All Tenants)

**Setup:**
- One `public` schema
- `guards` table has `tenant_id` column
- PostgreSQL RLS policies filter by `tenant_id`

**Pros:**
- ✅ Single schema, easier queries

**Cons:**
- ❌ **Security nightmare:** RLS bypass is silent (wrong tenant_id = data leak)
- ❌ **Operational risk:** One mistake in RLS policy and data is exposed
- ❌ **Not suitable for critical data**

### **Decision: Option A (PostgreSQL Schemas)**

**Why:** Perfect balance of cost, security, simplicity, and scalability. Industry-standard for SaaS. PostgreSQL schemas are purpose-built for exactly this use case.

---

## SCHEMA STRUCTURE

### Public Schema (Shared Metadata)

```sql
-- Central registry of all tenants
CREATE TABLE public.tenants (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,           -- e.g., "allied-security"
  name VARCHAR(255) NOT NULL,                 -- e.g., "Allied Security Ltd"
  email VARCHAR(255) NOT NULL,                -- tenant admin email
  status VARCHAR(50) DEFAULT 'active',        -- active, paused, cancelled
  tier VARCHAR(50) DEFAULT 'starter',
  max_guards INT DEFAULT 10,
  
  -- Stripe references
  stripe_customer_id VARCHAR(255) UNIQUE,
  subscription_id VARCHAR(255),
  current_period_start BIGINT,
  current_period_end BIGINT,
  
  -- Schema reference
  database_name VARCHAR(100),                 -- e.g., "tenant_1"
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- Billing tables
CREATE TABLE public.subscriptions (...);
CREATE TABLE public.payments (...);

-- Admin management
CREATE TABLE public.master_admins (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer',          -- viewer, editor, super_admin
  mfa_enabled BOOLEAN DEFAULT TRUE,
  created_at BIGINT,
  last_login BIGINT
);

-- Compliance & debugging
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(50),                     -- 'master_admin', 'tenant_admin', 'system'
  actor_id BIGINT,
  action VARCHAR(100),                        -- 'tenant_created', 'payment_charged', 'access_revoked'
  target_type VARCHAR(50),                    -- 'tenant', 'subscription', 'user'
  target_id BIGINT,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at BIGINT
);

-- Feature flags
CREATE TABLE public.tenant_feature_flags (
  tenant_id BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  flags JSONB DEFAULT '{}',                   -- { "videos_enabled": true, ... }
  updated_at BIGINT
);
```

### Per-Tenant Schema (Automatically Created)

**On tenant signup:**

```bash
# Tenant "allied-security" gets tenant_id = 123
# Schema name: tenant_123

CREATE SCHEMA tenant_123;
```

**Within tenant schema:**

```sql
-- All data tables specific to this tenant
-- Copied from backend/src/db/schema.ts

CREATE TABLE tenant_123.admins (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',          -- owner, manager, secretary, payroll_manager
  mfa_secret VARCHAR(255),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at BIGINT,
  updated_at BIGINT,
  last_login BIGINT
);

CREATE TABLE tenant_123.guards (
  id BIGSERIAL PRIMARY KEY,
  sia_license_number VARCHAR(50) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  created_at BIGINT,
  updated_at BIGINT
);

CREATE TABLE tenant_123.shifts (
  id BIGSERIAL PRIMARY KEY,
  guard_id BIGINT REFERENCES guards(id) ON DELETE CASCADE,
  start_time BIGINT,
  end_time BIGINT,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at BIGINT
);

-- All other existing tables (incidents, payroll_records, etc.)
```

---

## TENANT DETECTION FLOW

### HTTP Request → Tenant Context

```
Request arrives at backend
│
├─ Extract hostname: "allied-security.strondis.com"
│
├─ Check if master admin domain
│  └─ "admin-master.strondis.com" → req.isMasterAdmin = true, skip tenant detection
│
├─ Extract subdomain: "allied-security"
│
├─ Query public.tenants WHERE slug = 'allied-security'
│
├─ Verify tenant status
│  ├─ If 'paused' → reject with 403
│  ├─ If 'active' → continue
│  └─ Check subscription (free trial or active subscription)
│
└─ Attach to request: req.tenant = { tenantId: 1, schemaName: 'tenant_1', ... }
```

### Code Implementation

**File:** `backend/src/middleware/tenantDetection.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

export interface TenantContext {
  tenantId: number;
  tenantSlug: string;
  schemaName: string;
  maxGuards: number;
  tier: string;
  subscriptionStatus: string;
  trialEndsAt: number;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      isMasterAdmin?: boolean;
    }
  }
}

export async function detectTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const hostname = req.hostname;
  
  // Master admin routes bypass tenant detection
  if (
    hostname === 'admin-master.strondis.com' ||
    hostname === 'localhost:3001' ||
    hostname.includes('localhost:3001')
  ) {
    req.isMasterAdmin = true;
    return next();
  }
  
  // Extract tenant slug from subdomain
  // "allied-security.strondis.com" → "allied-security"
  // "localhost:3000" → skip (development fallback)
  
  const parts = hostname.split('.');
  if (parts.length < 2 || hostname === 'localhost') {
    return res.status(400).json({ error: 'Invalid hostname' });
  }
  
  const tenantSlug = parts[0];
  
  try {
    // Look up tenant
    const result = await pool.query(
      `SELECT 
        id, slug, name, tier, max_guards, status,
        (SELECT status FROM public.subscriptions WHERE tenant_id = public.tenants.id LIMIT 1) as subscription_status,
        (SELECT trial_ends_at FROM public.subscriptions WHERE tenant_id = public.tenants.id LIMIT 1) as trial_ends_at
      FROM public.tenants 
      WHERE slug = $1`,
      [tenantSlug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const tenant = result.rows[0];
    
    // Check tenant status
    if (tenant.status === 'paused') {
      return res.status(403).json({ 
        error: 'Your account has been paused. Please contact support.' 
      });
    }
    
    if (tenant.status === 'cancelled') {
      return res.status(403).json({ 
        error: 'Your account has been cancelled. Contact us to reactivate.' 
      });
    }
    
    // Check subscription (free trial or active paid)
    const now = Math.floor(Date.now() / 1000);
    const isOnTrial = tenant.trial_ends_at && tenant.trial_ends_at > now;
    const isSubscriptionActive = tenant.subscription_status === 'active';
    
    if (!isOnTrial && !isSubscriptionActive) {
      return res.status(403).json({ 
        error: 'Subscription expired. Please renew to continue.' 
      });
    }
    
    // Attach tenant context
    req.tenant = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      schemaName: `tenant_${tenant.id}`,
      maxGuards: tenant.max_guards,
      tier: tenant.tier,
      subscriptionStatus: tenant.subscription_status,
      trialEndsAt: tenant.trial_ends_at
    };
    
    next();
  } catch (error) {
    console.error('[Tenant Detection] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## DATABASE CONNECTION POOLING

### Challenge

PostgreSQL connection pools need to dynamically switch between schemas. Naïve approach:

```typescript
// WRONG — creates new connection per query
pool.query(`SET search_path TO tenant_1; SELECT * FROM guards;`);
pool.query(`SET search_path TO tenant_2; SELECT * FROM guards;`);
```

Problem: If connection is reused, `search_path` is sticky (affects next query with different tenant).

### Solution: Query Wrapper with Explicit Schema

**File:** `backend/src/db/pool.ts`

```typescript
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // max connections
  idleTimeoutMillis: 30000,
});

/**
 * Enhanced query function that:
 * 1. Sets search_path to tenant schema
 * 2. Executes query
 * 3. Resets search_path (cleanup)
 */
export async function query(
  sql: string,
  values?: any[],
  tenantId?: number
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  
  try {
    if (tenantId) {
      // Set schema for this connection
      const schemaName = `tenant_${tenantId}`;
      await client.query(`SET search_path TO ${schemaName}, public`);
    }
    
    // Execute user query
    const result = await client.query(sql, values);
    
    // Reset search_path (cleanup for connection reuse)
    await client.query(`SET search_path TO public`);
    
    return result;
  } finally {
    client.release();
  }
}

export { pool };
```

### Usage in Routes

```typescript
// Example: Get guards for tenant
router.get('/api/guards', async (req, res) => {
  const result = await query(
    'SELECT * FROM guards',
    [],
    req.tenant.tenantId  // Automatically uses tenant_123 schema
  );
  
  res.json(result.rows);
});
```

---

## TENANT SIGNUP FLOW

### Step-by-Step Tenant Provisioning

```
POST /api/signup
├─ Validate inputs (company name, email, password, tier)
├─ Generate slug from company name
├─ Check slug uniqueness in public.tenants
├─ Hash password
├─ Create Stripe customer (for invoicing)
├─ Insert into public.tenants (returns tenant_id = 123)
├─ CREATE SCHEMA tenant_123
├─ Initialize schema (copy DDL from schema.ts template)
├─ Create initial admin user in tenant_123.admins
├─ Create subscription (30-day free trial)
├─ Log audit event
└─ Return { tenantId, slug, adminUrl, trialEndsAt }
```

**Code:**

```typescript
// backend/src/routes/signupV2.ts

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { pool, query } from '../db/pool';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface SignupRequest {
  companyName: string;
  email: string;
  password: string;
  tier: 'starter' | 'professional' | 'enterprise';
}

router.post('/signup', async (req, res) => {
  const { companyName, email, password, tier } = req.body as SignupRequest;
  
  try {
    // 1. Validate
    if (!companyName || !email || !password || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }
    
    // 2. Generate slug
    const slug = companyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // 3. Check uniqueness
    const existing = await pool.query(
      'SELECT id FROM public.tenants WHERE slug = $1',
      [slug]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Company name already taken' });
    }
    
    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 5. Tier config
    const tiers: Record<string, { maxGuards: number; priceCents: number }> = {
      starter: { maxGuards: 10, priceCents: 34900 },
      professional: { maxGuards: 50, priceCents: 69900 },
      enterprise: { maxGuards: 500, priceCents: 249900 },
    };
    
    const tierConfig = tiers[tier];
    if (!tierConfig) {
      return res.status(400).json({ error: 'Invalid tier' });
    }
    
    // 6. Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email: email,
      name: companyName,
      metadata: { slug, tier },
    });
    
    // 7. Insert into public.tenants
    const tenantResult = await pool.query(
      `INSERT INTO public.tenants 
        (slug, name, email, tier, max_guards, stripe_customer_id, status, database_name)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING id`,
      [slug, companyName, email, tier, tierConfig.maxGuards, stripeCustomer.id, `tenant_${Date.now()}`]
    );
    
    const tenantId = tenantResult.rows[0].id;
    const schemaName = `tenant_${tenantId}`;
    
    // 8. CREATE SCHEMA
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    
    // 9. Initialize schema (DDL)
    await initializeTenantSchema(schemaName, tenantId);
    
    // 10. Create initial admin
    const adminResult = await query(
      `INSERT INTO admins (email, password_hash, role, mfa_enabled)
       VALUES ($1, $2, 'owner', false)
       RETURNING id`,
      [email, passwordHash],
      tenantId
    );
    
    // 11. Create subscription (30-day trial)
    const trialEndsAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    
    await pool.query(
      `INSERT INTO public.subscriptions 
        (tenant_id, plan_code, price_monthly_cents, status, trial_ends_at)
      VALUES ($1, $2, $3, 'trialing', $4)`,
      [tenantId, tier, tierConfig.priceCents, trialEndsAt]
    );
    
    // 12. Audit log
    await pool.query(
      `INSERT INTO public.audit_logs 
        (actor_type, action, target_type, target_id, details, ip_address)
      VALUES ('system', 'tenant_created', 'tenant', $1, $2, $3)`,
      [tenantId, JSON.stringify({ slug, email, tier }), req.ip]
    );
    
    // Return success
    res.status(201).json({
      tenantId,
      slug,
      message: `Welcome to Strondis! Your 30-day free trial starts now.`,
      trialEndsAt,
      adminUrl: `https://${slug}.strondis.com`,
    });
    
  } catch (error) {
    console.error('[Signup] Error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * Initialize tenant schema with all tables
 * This is called once per tenant on signup
 */
async function initializeTenantSchema(schemaName: string, tenantId: number) {
  const client = await pool.connect();
  
  try {
    // Set search path
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    // Copy entire schema structure from backend/src/db/schema.ts
    // All CREATE TABLE statements run within this schema
    
    await client.query(`
      CREATE TABLE admins (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        mfa_secret VARCHAR(255),
        mfa_enabled BOOLEAN DEFAULT FALSE,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
        last_login BIGINT
      );
      
      CREATE TABLE guards (
        id BIGSERIAL PRIMARY KEY,
        sia_license_number VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'active',
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      
      -- ... all other tables (shifts, incidents, payroll_records, etc.)
    `);
    
    console.log(`[Schema Init] Initialized ${schemaName}`);
  } finally {
    client.release();
  }
}

export default router;
```

---

## SECURITY: POSTGRESQL ROLES & ACCESS CONTROL

### Goal

Prevent a data breach in one tenant from exposing other tenants' data.

### Strategy: Per-Schema PostgreSQL Roles

```sql
-- Create a role for tenant_123
CREATE ROLE tenant_123_user WITH PASSWORD 'secureRandomPassword';

-- Grant access to tenant_123 schema only
GRANT USAGE ON SCHEMA tenant_123 TO tenant_123_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_123 TO tenant_123_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_123 TO tenant_123_user;

-- Revoke access to other schemas
REVOKE ALL ON SCHEMA public FROM tenant_123_user;
REVOKE ALL ON SCHEMA tenant_124 FROM tenant_123_user;

-- Allow read-only access to subscription info
GRANT USAGE ON SCHEMA public TO tenant_123_user;
GRANT SELECT ON public.subscriptions TO tenant_123_user;
GRANT SELECT ON public.payments TO tenant_123_user;
GRANT SELECT ON public.tenants TO tenant_123_user;  -- read own tenant record

-- But NOT admin/audit logs/master tables
REVOKE SELECT ON public.master_admins FROM tenant_123_user;
REVOKE SELECT ON public.audit_logs FROM tenant_123_user;
```

### Implementation

**On tenant signup, create the role:**

```typescript
async function createTenantRole(tenantId: number) {
  const roleName = `tenant_${tenantId}_user`;
  const password = generateSecurePassword();
  
  // Create role
  await pool.query(
    `CREATE ROLE ${roleName} WITH PASSWORD $1 LOGIN`,
    [password]
  );
  
  // Grant schema access
  await pool.query(
    `GRANT USAGE ON SCHEMA tenant_${tenantId} TO ${roleName}`
  );
  
  await pool.query(
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_${tenantId} TO ${roleName}`
  );
  
  // Store role credentials for future connections
  // (Optional: use for direct tenant connections if needed)
}
```

---

## DATA ISOLATION GUARANTEES

### Threat Model

**Threat 1: Accidental query with wrong tenant_id**

```typescript
// VULNERABLE CODE (DO NOT DO THIS)
const result = await pool.query(
  'SELECT * FROM guards WHERE id = $1',  // Missing WHERE tenant_id = ?
  [guardId]
);
```

**Mitigation:** Use schema detection (not tenant_id filtering).

```typescript
// SAFE CODE
const result = await query(
  'SELECT * FROM guards WHERE id = $1',  // Schema already switched
  [guardId],
  req.tenant.tenantId  // Enforces schema
);

// Query runs in tenant_123 schema
// Can only access tenant_123.guards
// Even if WHERE clause is wrong, can't access other tenants
```

---

**Threat 2: SQL Injection in WHERE clause**

```typescript
// VULNERABLE
const result = await query(
  `SELECT * FROM guards WHERE email = '${email}'`,  // No parameterization
  [],
  req.tenant.tenantId
);
```

**Mitigation:** Always use parameterized queries.

```typescript
// SAFE
const result = await query(
  'SELECT * FROM guards WHERE email = $1',
  [email],
  req.tenant.tenantId
);
```

---

**Threat 3: PostgreSQL search_path confusion**

```typescript
// VULNERABLE (if search_path isn't reset)
await pool.query(`SET search_path TO tenant_1`);
// ... user logs out ...
await pool.query(`SELECT * FROM sensitive_table`);  // Still in tenant_1 schema!
```

**Mitigation:** Always reset search_path after query.

```typescript
// SAFE (query wrapper resets)
try {
  await client.query(`SET search_path TO ${schemaName}`);
  const result = await client.query(sql, values);
  return result;
} finally {
  await client.query(`SET search_path TO public`);  // Reset
  client.release();
}
```

---

## OPERATIONAL CONSIDERATIONS

### Monitoring Schema Health

```sql
-- Check schema sizes
SELECT 
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as size
FROM pg_tables
WHERE schemaname LIKE 'tenant_%'
GROUP BY schemaname
ORDER BY size DESC;

-- Find tables missing indexes
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname LIKE 'tenant_%'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE pg_indexes.schemaname = pg_tables.schemaname
      AND pg_indexes.tablename = pg_tables.tablename
  );
```

### Backup Strategy

```bash
# Backup all schemas
pg_dump -h $DB_HOST -U $DB_USER -d postgres > full_backup.sql

# Backup single tenant schema
pg_dump -h $DB_HOST -U $DB_USER -d postgres -n tenant_123 > tenant_123_backup.sql

# Restore single tenant
psql -h $DB_HOST -U $DB_USER -d postgres < tenant_123_backup.sql
```

### Scaling Limits

**PostgreSQL can handle:**
- ✅ Thousands of schemas (each tenant gets one)
- ✅ Millions of rows per schema
- ✅ Hundreds of connections (Railway pools handles this)

**When to consider separate databases:**
- ❌ If you have 1000+ tenants (then resource costs dominate)
- ❌ If you need per-tenant backup/restore independently
- ❌ If you need complete database-level isolation (paranoid security)

For MVP and first 100 tenants, schema approach is ideal.

---

## DATA EXPORT & CHURN

### Tenant Data Export (On Cancellation)

**Endpoint:** `GET /api/tenant/export`

```typescript
router.get('/export', requireAuth, async (req, res) => {
  const { tenantId } = req.tenant;
  const schemaName = req.tenant.schemaName;
  
  try {
    // Export all tables as JSON
    const tables = ['guards', 'shifts', 'incidents', 'payroll_records', 'messages'];
    const export_data = {};
    
    for (const table of tables) {
      const result = await query(
        `SELECT * FROM ${table}`,
        [],
        tenantId
      );
      export_data[table] = result.rows;
    }
    
    // Return as downloadable file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=strondis-export.json');
    res.json(export_data);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});
```

### Archive vs. Delete

**On tenant cancellation, master admin can choose:**

1. **Archive:** Keep schema intact, mark as archived
   ```sql
   UPDATE public.tenants SET status = 'archived' WHERE id = 123;
   -- Schema remains (takes up storage)
   -- Tenant can request restore within 30 days
   ```

2. **Delete:** Drop schema permanently (GDPR right to be forgotten)
   ```sql
   DROP SCHEMA IF EXISTS tenant_123 CASCADE;
   UPDATE public.tenants SET status = 'deleted' WHERE id = 123;
   -- All data permanently removed
   ```

---

## TESTING MULTI-TENANCY

### Test Scenario 1: Tenant Isolation

```typescript
it('should not allow tenant A to access tenant B data', async () => {
  // Create two tenants
  const tenantA = await createTestTenant('Company A');
  const tenantB = await createTestTenant('Company B');
  
  // Add guard to tenant A
  await query('INSERT INTO guards (first_name) VALUES ($1)', ['John'], tenantA.id);
  
  // Try to access from tenant B
  const result = await query('SELECT * FROM guards', [], tenantB.id);
  
  // Should be empty (tenant B has no guards)
  expect(result.rows.length).toBe(0);
});
```

### Test Scenario 2: Schema Isolation

```typescript
it('should prevent SQL injection from crossing schemas', async () => {
  const tenantA = await createTestTenant('Company A');
  
  // Try SQL injection to access another schema
  const maliciousEmail = "test@test.com' UNION SELECT * FROM tenant_999.guards--";
  
  const result = await query(
    'SELECT * FROM guards WHERE email = $1',
    [maliciousEmail],
    tenantA.id
  );
  
  // Should find no results (parameterized query prevents injection)
  expect(result.rows.length).toBe(0);
});
```

---

## CONCLUSION

This RFC specifies:

✅ PostgreSQL schema-based multi-tenancy  
✅ Automatic schema provisioning on signup  
✅ Tenant detection via hostname (subdomains)  
✅ Query wrapper for transparent schema switching  
✅ PostgreSQL roles for access control  
✅ Data isolation guarantees  
✅ Archive/delete on churn  
✅ Testing strategies  

Implementation should follow exactly as specified in `MASTER_SPECIFICATION_v1.md` Section 3 & 4.

---

**END OF RFC #2**
