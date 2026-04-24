# STRONDIS SAAS PLATFORM UPGRADE — MASTER SPECIFICATION v1 (PART 2)

**Continuing from Part 1**  
**Document Version:** 1.0  
**Generated:** April 21, 2026

---

## FEATURE FLAGS & CONFIGURATION

### Feature Flag System

**File:** `backend/src/services/featureFlagManager.ts` (NEW)

```typescript
import { pool } from '../db/pool';

interface FeatureFlags {
  stripe_payments_enabled: boolean;
  multi_tenancy_enabled: boolean;
  onboarding_videos_enabled: boolean;
  websocket_messaging_enabled: boolean;
  geofencing_alerts_enabled: boolean;
  api_v2_enabled: boolean;
}

/**
 * Centralized feature flag manager
 * Reads from environment variables and database (for per-tenant overrides)
 */
export class FeatureFlagManager {
  private static cache: Map<string, FeatureFlags> = new Map();
  private static globalFlags: FeatureFlags | null = null;
  
  /**
   * Get global flags (apply to all tenants)
   */
  static async getGlobalFlags(): Promise<FeatureFlags> {
    if (this.globalFlags) return this.globalFlags;
    
    this.globalFlags = {
      stripe_payments_enabled: process.env.FEATURE_STRIPE === 'true',
      multi_tenancy_enabled: process.env.FEATURE_MULTI_TENANCY === 'true',
      onboarding_videos_enabled: process.env.FEATURE_VIDEOS === 'true',
      websocket_messaging_enabled: process.env.FEATURE_WEBSOCKETS === 'true',
      geofencing_alerts_enabled: process.env.FEATURE_GEOFENCING === 'true',
      api_v2_enabled: process.env.FEATURE_API_V2 === 'true',
    };
    
    return this.globalFlags;
  }
  
  /**
   * Get tenant-specific flags (can override global)
   */
  static async getTenantFlags(tenantId: number): Promise<FeatureFlags> {
    const cacheKey = `tenant_${tenantId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const global = await this.getGlobalFlags();
    
    // Check database for tenant-specific overrides
    const result = await pool.query(
      'SELECT flags FROM public.tenant_feature_flags WHERE tenant_id = $1',
      [tenantId]
    );
    
    let tenantFlags = { ...global };
    if (result.rows.length > 0) {
      tenantFlags = { ...global, ...result.rows[0].flags };
    }
    
    this.cache.set(cacheKey, tenantFlags);
    return tenantFlags;
  }
  
  /**
   * Admin method: Toggle a feature for a specific tenant
   */
  static async setTenantFlag(tenantId: number, flag: keyof FeatureFlags, enabled: boolean) {
    const current = await this.getTenantFlags(tenantId);
    const updated = { ...current, [flag]: enabled };
    
    await pool.query(
      `INSERT INTO public.tenant_feature_flags (tenant_id, flags, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO UPDATE SET flags = $2, updated_at = $3`,
      [tenantId, JSON.stringify(updated), Math.floor(Date.now() / 1000)]
    );
    
    this.cache.delete(`tenant_${tenantId}`); // Invalidate cache
  }
  
  /**
   * Admin method: Toggle a feature globally
   */
  static setGlobalFlag(flag: keyof FeatureFlags, enabled: boolean) {
    process.env[`FEATURE_${flag.toUpperCase()}`] = enabled ? 'true' : 'false';
    this.globalFlags = null; // Invalidate cache
    this.cache.clear();
  }
}

export default FeatureFlagManager;
```

### Feature Flag Database Table

```sql
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  tenant_id BIGINT PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  flags JSONB DEFAULT '{}',
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);
```

### Master Admin Endpoint for Feature Flags

```typescript
// backend/src/routes/masterAdminFlags.ts (NEW)

router.get('/flags', requireMasterAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tenant_id, flags FROM public.tenant_feature_flags ORDER BY tenant_id`
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
});

router.post('/flags/tenant/:tenantId/:flag', requireMasterAdmin, requireRole('super_admin'), async (req, res) => {
  const { tenantId, flag } = req.params;
  const { enabled } = req.body;
  
  try {
    await FeatureFlagManager.setTenantFlag(parseInt(tenantId), flag as any, enabled);
    
    await pool.query(
      `INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details)
       VALUES ('master_admin', $1, 'flag_toggled', 'tenant', $2, $3)`,
      [req.user.adminId, tenantId, JSON.stringify({ flag, enabled })]
    );
    
    res.json({ message: `${flag} toggled to ${enabled}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

router.post('/flags/global/:flag', requireMasterAdmin, requireRole('super_admin'), async (req, res) => {
  const { flag } = req.params;
  const { enabled } = req.body;
  
  try {
    FeatureFlagManager.setGlobalFlag(flag as any, enabled);
    
    res.json({ message: `Global ${flag} toggled to ${enabled}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update global flag' });
  }
});
```

### Environment Variables (Deployment)

```bash
# .env (backend)
FEATURE_STRIPE=true                    # Enable Stripe payments
FEATURE_MULTI_TENANCY=true             # Enable multi-tenant mode
FEATURE_VIDEOS=false                   # Disabled initially (enable via master admin)
FEATURE_WEBSOCKETS=false               # For future real-time chat
FEATURE_GEOFENCING=false               # For future geofencing alerts
FEATURE_API_V2=false                   # For backward compatibility
```

---

## API CONTRACTS & ENDPOINT CHANGES

### Signup Endpoint (New Multi-Tenant Path)

**Endpoint:** `POST /api/signup`

**Request:**
```json
{
  "companyName": "Allied Security Ltd",
  "email": "admin@allied.com",
  "password": "SecurePassword123!",
  "tier": "starter"
}
```

**Response:**
```json
{
  "tenantId": 123,
  "slug": "allied-security",
  "message": "Welcome Allied Security Ltd! Your 30-day free trial starts now.",
  "trialEndsAt": 1746328461,
  "adminUrl": "https://allied-security.strondis.com"
}
```

---

### Login Endpoint (Tenant-Specific)

**Endpoint:** `POST /api/auth/login`

**Subdomain:** `[tenant-slug].strondis.com`

**Request:**
```json
{
  "email": "admin@allied.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "adminId": 456,
  "email": "admin@allied.com",
  "role": "owner"
}
```

---

### Guards List (Tenant-Specific)

**Endpoint:** `GET /api/guards`

**Subdomain:** `[tenant-slug].strondis.com`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "tenantId": 123,
    "siaLicenseNumber": "SIA-123456",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "status": "active"
  }
]
```

**Note:** Query automatically scoped to `req.tenant.tenantId`. No need to pass it explicitly.

---

### Feature Flags Endpoint (Client-Side)

**Endpoint:** `GET /api/feature-flags`

**Response:**
```json
{
  "stripe_payments_enabled": true,
  "onboarding_videos_enabled": false,
  "websocket_messaging_enabled": false
}
```

---

### Master Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/master-admin/auth/login` | POST | Master admin login |
| `/api/master-admin/tenants` | GET | List all tenants |
| `/api/master-admin/tenants/:id` | GET | Tenant details |
| `/api/master-admin/tenants/:id/pause` | POST | Pause tenant access |
| `/api/master-admin/tenants/:id/resume` | POST | Resume tenant access |
| `/api/master-admin/subscriptions` | GET | List subscriptions |
| `/api/master-admin/payments` | GET | List payments |
| `/api/master-admin/payments/:id/refund` | POST | Process refund |
| `/api/master-admin/users` | GET | List master admins |
| `/api/master-admin/users` | POST | Create master admin |
| `/api/master-admin/audit-logs` | GET | Audit log search |
| `/api/master-admin/flags` | GET | List feature flags |
| `/api/master-admin/flags/global/:flag` | POST | Toggle global flag |
| `/api/master-admin/flags/tenant/:tenantId/:flag` | POST | Toggle tenant flag |

---

## DEPLOYMENT SEQUENCE & GIT WORKFLOW

### Pre-Deployment Checklist

```markdown
## Before You Deploy (April 30, 2026)

- [ ] All code committed to `master` branch
- [ ] Database migrations tested locally (or on Railway staging)
- [ ] Environment variables set on Railway (FEATURE_*, STRIPE_*)
- [ ] Stripe webhook configured (see below)
- [ ] Master admin first user created manually
- [ ] Email service (Resend) tested
- [ ] Cron jobs configured (billing, renewal)
```

### Step 1: Create Master Admin User (One-Time Setup)

**Run manually on Railway:**

```bash
# SSH into Railway or run via psql
psql $DATABASE_URL

INSERT INTO public.master_admins (email, password_hash, role, mfa_enabled)
VALUES ('okekecaleb69@gmail.com', '$2b$10$...', 'super_admin', true);
```

---

### Step 2: Database Schema Migration

**File:** `backend/src/db/migrate.ts` (NEW)

```typescript
import { pool } from './pool';

/**
 * Runs once on backend startup
 * Creates public schema and all shared tables
 */
export async function migrate() {
  console.log('[Migration] Starting...');
  
  try {
    // Public schema (shared, persistent)
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS public;
      
      CREATE TABLE IF NOT EXISTS public.tenants (...);
      CREATE TABLE IF NOT EXISTS public.subscriptions (...);
      CREATE TABLE IF NOT EXISTS public.payments (...);
      CREATE TABLE IF NOT EXISTS public.master_admins (...);
      CREATE TABLE IF NOT EXISTS public.audit_logs (...);
      CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (...);
    `);
    
    console.log('[Migration] Public schema created');
    
    // Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
      CREATE INDEX IF NOT EXISTS idx_tenants_subscription ON public.tenants(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
    `);
    
    console.log('[Migration] Complete');
  } catch (error) {
    console.error('[Migration] Failed:', error);
    throw error;
  }
}
```

**Call in `backend/src/index.ts`:**

```typescript
import { migrate } from './db/migrate';

// On startup
(async () => {
  await migrate();
  
  // Then start Express
  app.listen(3000, () => console.log('Server running'));
})();
```

---

### Step 3: Git Commit & Push

**File structure after changes:**

```
backend/
├── src/
│   ├── index.ts                          [MODIFIED]
│   ├── middleware/
│   │   └── tenantDetection.ts            [NEW]
│   ├── routes/
│   │   ├── signupV2.ts                   [NEW]
│   │   ├── masterAdminAuth.ts            [NEW]
│   │   ├── masterAdminTenants.ts         [NEW]
│   │   ├── masterAdminPayments.ts        [NEW]
│   │   ├── masterAdminUsers.ts           [NEW]
│   │   ├── masterAdminFlags.ts           [NEW]
│   │   ├── featureFlags.ts               [NEW]
│   │   └── webhooks/
│   │       └── stripe.ts                 [NEW]
│   ├── services/
│   │   ├── billingCron.ts                [NEW]
│   │   ├── renewalCron.ts                [NEW]
│   │   └── featureFlagManager.ts         [NEW]
│   └── db/
│       ├── schema.ts                     [MODIFIED — add public tables]
│       ├── migrate.ts                    [NEW]
│       └── pool.ts                       [MODIFIED — add query wrapper]
├── package.json                          [MODIFIED — add stripe, node-cron]
└── .env                                  [MODIFIED — add FEATURE_* vars]

frontend/
├── src/
│   ├── App.tsx                           [MODIFIED]
│   ├── pages/
│   │   └── Onboarding/                   [NEW]
│   ├── components/
│   │   └── OnboardingModal.tsx           [NEW]
│   ├── hooks/
│   │   └── useOnboarding.ts              [NEW]
│   └── api/
│       └── index.ts                      [MODIFIED]
└── vite.config.ts                        [UNCHANGED]

guard-app/
├── src/
│   └── api/
│       └── index.ts                      [MODIFIED]
└── [no significant changes]

master-admin/                             [NEW APP]
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── Tenants/
│   │   ├── Subscriptions/
│   │   ├── Payments/
│   │   ├── Users/
│   │   ├── AuditLogs/
│   │   └── Settings/
│   ├── api/
│   │   └── masterAdminApi.ts
│   └── components/
│       ├── Layout.tsx
│       └── SidebarNav.tsx
├── vite.config.ts
├── vercel.json
├── package.json
└── .env

landing/
└── [UNCHANGED — already B2B positioned]
```

**Commit message:**

```bash
git add .
git commit -m "feat: multi-tenancy, Stripe payments, master admin, onboarding

- Add multi-tenant architecture with separate PostgreSQL schemas
- Implement Stripe payment system with billing cron + retry logic
- Create master admin panel (separate app)
- Add onboarding tutorial system with feature flags
- Add role-based access control and audit logging
- Database schema migration system
- Feature flag manager for gradual rollout"

git push origin master
```

---

### Step 4: Deploy Backend

```bash
# From local machine
cd "C:/Users/USER/Desktop/security-guard-crm/backend"

# Set Railway env vars
railway variables set FEATURE_STRIPE=true
railway variables set FEATURE_MULTI_TENANCY=true
railway variables set FEATURE_VIDEOS=false
railway variables set STRIPE_SECRET_KEY=sk_test_...
railway variables set STRIPE_WEBHOOK_SECRET=whsec_...

# Deploy
railway up --detach

# Check logs
railway logs --tail 100
```

---

### Step 5: Deploy Frontends (Vercel Auto-Deploy)

```bash
# Already handled by Vercel webhook on git push
# Verify at:
# - https://frontend-calebxcodes-projects.vercel.app (admin CRM)
# - https://guard-app-ten.vercel.app (guard app)
# - https://strondis.com (landing)
```

---

### Step 6: Deploy Master Admin

```bash
# Create new Vercel project for master-admin
cd "C:/Users/USER/Desktop/security-guard-crm/master-admin"

# Initialize Vercel project
vercel init

# Configure environment
vercel env add VITE_API_URL
# → https://guardops-api-production.up.railway.app

# Deploy
vercel --prod

# Result: https://admin-master.strondis.com
```

---

### Step 7: Configure Stripe Webhook

**In Stripe Dashboard:**

1. Go to **Developers** → **Webhooks**
2. Add endpoint: `https://guardops-api-production.up.railway.app/api/webhooks/stripe`
3. Select events: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
4. Copy webhook secret → Railway env var `STRIPE_WEBHOOK_SECRET`

---

### Step 8: Verify Deployment

**Checklist:**

- [ ] Master admin login works at `admin-master.strondis.com`
- [ ] Signup creates new tenant + schema
- [ ] Can login to tenant at `[slug].strondis.com`
- [ ] Feature flags show correctly at `GET /api/feature-flags`
- [ ] Stripe payment test (use test card `4242 4242 4242 4242`)
- [ ] Cron logs show in Railway (check daily at 08:00 UTC)
- [ ] Audit logs record actions in `public.audit_logs`

---

## TESTING STRATEGY

### Unit Tests

**File:** `backend/src/services/featureFlagManager.test.ts`

```typescript
import { FeatureFlagManager } from './featureFlagManager';

describe('FeatureFlagManager', () => {
  it('should return global flags', async () => {
    const flags = await FeatureFlagManager.getGlobalFlags();
    expect(flags.stripe_payments_enabled).toBe(true);
  });
  
  it('should return tenant-specific flags', async () => {
    const flags = await FeatureFlagManager.getTenantFlags(1);
    expect(flags).toHaveProperty('stripe_payments_enabled');
  });
  
  it('should toggle tenant flag', async () => {
    await FeatureFlagManager.setTenantFlag(1, 'onboarding_videos_enabled', true);
    const flags = await FeatureFlagManager.getTenantFlags(1);
    expect(flags.onboarding_videos_enabled).toBe(true);
  });
});
```

### Integration Tests (Tenant Signup & Billing)

**File:** `backend/src/routes/signupV2.test.ts`

```typescript
import request from 'supertest';
import app from '../index';
import { pool } from '../db/pool';

describe('Signup Flow', () => {
  afterEach(async () => {
    // Cleanup
    await pool.query('DELETE FROM public.tenants WHERE email = $1', ['test@example.com']);
  });
  
  it('should create a new tenant with 30-day trial', async () => {
    const response = await request(app)
      .post('/api/signup')
      .send({
        companyName: 'Test Security Co',
        email: 'test@example.com',
        password: 'Password12345',
        tier: 'starter',
      });
    
    expect(response.status).toBe(201);
    expect(response.body.tenantId).toBeDefined();
    expect(response.body.trialEndsAt).toBeDefined();
    
    // Verify in database
    const result = await pool.query(
      'SELECT * FROM public.tenants WHERE email = $1',
      ['test@example.com']
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].status).toBe('active');
  });
  
  it('should reject duplicate company names', async () => {
    // Create first tenant
    await request(app)
      .post('/api/signup')
      .send({
        companyName: 'Unique Security',
        email: 'first@example.com',
        password: 'Password12345',
        tier: 'starter',
      });
    
    // Try to create duplicate
    const response = await request(app)
      .post('/api/signup')
      .send({
        companyName: 'Unique Security',
        email: 'second@example.com',
        password: 'Password12345',
        tier: 'starter',
      });
    
    expect(response.status).toBe(409);
  });
});
```

### E2E Tests (Full User Journey)

**File:** `backend/src/e2e/tenant-onboarding.test.ts`

```typescript
import request from 'supertest';
import app from '../index';

describe('Tenant Onboarding E2E', () => {
  let tenantSlug: string;
  let adminToken: string;
  
  it('1. Tenant signs up', async () => {
    const signupResponse = await request(app)
      .post('/api/signup')
      .send({
        companyName: 'E2E Test Co',
        email: 'e2e@test.com',
        password: 'Password12345',
        tier: 'starter',
      });
    
    expect(signupResponse.status).toBe(201);
    tenantSlug = signupResponse.body.slug;
  });
  
  it('2. Tenant admin logs in', async () => {
    const loginResponse = await request(app)
      .post(`/api/auth/login`)
      .set('Host', `${tenantSlug}.strondis.com`)
      .send({
        email: 'e2e@test.com',
        password: 'Password12345',
      });
    
    expect(loginResponse.status).toBe(200);
    adminToken = loginResponse.body.token;
  });
  
  it('3. Tenant can fetch their guards (empty initially)', async () => {
    const guardsResponse = await request(app)
      .get('/api/guards')
      .set('Host', `${tenantSlug}.strondis.com`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(guardsResponse.status).toBe(200);
    expect(guardsResponse.body).toEqual([]);
  });
  
  it('4. Tenant can create a guard', async () => {
    const createResponse = await request(app)
      .post('/api/guards')
      .set('Host', `${tenantSlug}.strondis.com`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        siaLicenseNumber: 'SIA-12345',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBeDefined();
  });
});
```

---

## ROLLBACK & RECOVERY PROCEDURES

### Scenario 1: Stripe Integration Breaks Production

**Quick Fix:**

```bash
# 1. Disable Stripe feature flag globally
railway variables set FEATURE_STRIPE=false

# 2. Restart backend
railway up --detach

# 3. Investigate in logs
railway logs --tail 200 | grep "stripe\|payment\|error"

# 4. Once fixed, re-enable
railway variables set FEATURE_STRIPE=true
railway up --detach
```

---

### Scenario 2: Tenant Schema Corruption

**Recovery:**

```sql
-- If a single tenant's schema is corrupted:

-- 1. Backup their data
pg_dump -h [host] -U [user] -d [db] -n tenant_123 > backup_tenant_123.sql

-- 2. Drop corrupted schema
DROP SCHEMA tenant_123 CASCADE;

-- 3. Recreate from template
CREATE SCHEMA tenant_123;
-- Re-run tenant initialization SQL

-- 4. Restore data
psql -h [host] -U [user] -d [db] < backup_tenant_123.sql
```

---

### Scenario 3: Master Admin Account Compromised

**Recovery:**

```bash
# 1. Disable all master admin accounts
psql $DATABASE_URL
UPDATE public.master_admins SET role = 'viewer' WHERE role != 'locked';

# 2. Create new super_admin account
INSERT INTO public.master_admins (email, password_hash, role)
VALUES ('newadmin@strondis.com', '$2b$10$...', 'super_admin');

# 3. Force MFA on all accounts
UPDATE public.master_admins SET mfa_enabled = true;

# 4. Review audit logs
SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 50;
```

---

### Scenario 4: Payment Processing Stuck

**Recovery:**

```sql
-- Find stuck payments
SELECT * FROM public.payments WHERE status = 'pending' AND attempted_at < NOW() - INTERVAL '24 hours';

-- Manually mark as failed (trigger retry)
UPDATE public.payments 
SET status = 'failed', next_retry_at = EXTRACT(EPOCH FROM NOW()) + 3*86400
WHERE id = [payment_id];

-- Cron will retry in 3 days automatically
```

---

### Scenario 5: Billing Cron Not Running

**Verify:**

```bash
# Check Railway logs for "Billing Cron" entries
railway logs --tail 200 | grep "Billing Cron"

# If no entries after 08:30 UTC, check:
# 1. Are cron jobs installed?
railway variables | grep CRON

# 2. Is the backend running?
railway up --detach

# 3. Check for errors
railway logs --tail 100
```

---

## GIT WORKFLOW & CONTEXT MANAGEMENT

### Handoff Instructions for Future Developers

**Document:** `DEVELOPER_HANDOFF.md` (to be created in repo)

```markdown
# Strondis Development Handoff

## Quick Start

1. **Read the spec:**
   - `docs/MASTER_SPECIFICATION_v1.md` (architecture, database, API)
   - `docs/RFC_Stripe_Integration.md` (payment flow, webhooks)
   - `docs/RFC_MultiTenancy_Architecture.md` (schema isolation, provisioning)

2. **Set up locally:**
   ```bash
   git clone https://github.com/Calebxcodes/guardops-platform.git
   cd guardops-platform
   npm install
   cd backend && npm install && npm run dev
   cd ../frontend && npm install && npm run dev
   cd ../master-admin && npm install && npm run dev
   ```

3. **Check the deployment commands:**
   See `MASTER_SPECIFICATION_v1.md` Section 10 for exact Railway/Vercel commands.

## Critical Files

- `backend/src/middleware/tenantDetection.ts` — How we detect which tenant is requesting
- `backend/src/db/pool.ts` — How we switch database schemas
- `backend/src/routes/signupV2.ts` — How new tenants are created
- `backend/src/routes/webhooks/stripe.ts` — Payment webhook handler
- `backend/src/services/billingCron.ts` — Daily auto-charge logic
- `master-admin/src/pages/Dashboard/index.tsx` — Master admin UI

## Adding a New Feature

1. Create a feature flag in `backend/src/services/featureFlagManager.ts`
2. Add to `.env` as `FEATURE_[NAME]=false` (disabled by default)
3. Wrap your code: `if (flags.feature_name_enabled) { ... }`
4. Test locally, then enable on Railway via `railway variables set`

## Database Queries

**Always use the wrapper:**
```typescript
// Wrong
const result = await pool.query(sql, values);

// Correct (auto-sets tenant schema)
const result = await query(sql, values, req.tenant.tenantId);
```

## Deployment Checklist

- [ ] All changes committed to `master`
- [ ] Tests pass locally
- [ ] Railway env vars updated
- [ ] Feature flags tested
- [ ] Cron jobs in logs
- [ ] Stripe webhooks receiving events

See MASTER_SPECIFICATION_v1.md Section 10 for full deployment sequence.
```

---

## IMPLEMENTATION ROADMAP

### Upgrade Sequence

| Upgrade | Component | Status | Est. Hours | Files |
|---------|-----------|--------|-----------|-------|
| 27 | Multi-Tenant Database Architecture | TODO | 4 | `backend/src/db/migrate.ts`, `pool.ts` |
| 28 | Tenant Detection Middleware | TODO | 2 | `backend/src/middleware/tenantDetection.ts` |
| 29 | Signup Flow (V2) | TODO | 3 | `backend/src/routes/signupV2.ts` |
| 30 | Stripe Integration (Webhooks + Billing Cron) | TODO | 5 | `backend/src/routes/webhooks/stripe.ts`, `services/billingCron.ts` |
| 31 | Master Admin Backend Routes | TODO | 4 | `backend/src/routes/masterAdmin*.ts` (5 files) |
| 32 | Master Admin Frontend (React App) | TODO | 6 | `master-admin/src/pages/*.tsx` (7 pages) |
| 33 | Feature Flag System | TODO | 2 | `backend/src/services/featureFlagManager.ts` |
| 34 | Onboarding System (Frontend) | TODO | 3 | `frontend/src/pages/Onboarding/`, `hooks/useOnboarding.ts` |
| 35 | Testing (Unit + Integration + E2E) | TODO | 4 | `backend/src/**/*.test.ts` |
| 36 | Deployment & Verification | TODO | 2 | Manual (see Deployment section) |

**Total Estimated Effort:** ~35 hours  
**Timeline:** 9 days (April 21–30) = feasible at ~4 hours/day

---

## SUMMARY: WHAT YOU'RE GETTING

### Architecture

✅ **Single backend**, multi-tenant aware  
✅ **Separate PostgreSQL schemas** per tenant (logical isolation)  
✅ **Per-tenant subdomains** (allied-security.strondis.com)  
✅ **Master admin app** (separate from tenant apps)  

### Payments

✅ **Stripe integration** (Strondis account manages all charges)  
✅ **Auto-charge on trial expiry** (day 31)  
✅ **Retry logic** (3 days later if payment fails)  
✅ **Access revocation** if payment fails twice  
✅ **Webhook handling** (invoice events from Stripe)  

### Multi-Tenancy

✅ **Tenant signup** (creates new schema + subscription)  
✅ **Role-based access** (owner, manager, secretary, payroll manager)  
✅ **Data export** (tenant can download their data on churn)  
✅ **Archive or delete** (GDPR-compliant)  

### Onboarding

✅ **Tutorial system** with feature flag  
✅ **Video-ready** (disable/enable without code changes)  
✅ **Strondis-branded** (not custom per tenant)  

### Operations

✅ **Master admin panel** for you to manage all tenants  
✅ **Audit logging** (immutable record of all actions)  
✅ **Feature flags** (gradual rollout, tenant overrides)  
✅ **Billing monitoring** (dashboard of all subscriptions + payments)  

---

## NEXT STEPS

1. **Review both specification parts** (this document + Part 1)
2. **Confirm the architecture** (PostgreSQL schemas, Stripe billing, master admin structure)
3. **Answer any remaining questions** before implementation
4. **I'll generate three RFCs** (Stripe, MultiTenancy, Onboarding) with detailed decision logic
5. **We'll implement in upgrade sequence 27–36** with zero context loss

**Total specification document:** ~15,000 words  
**Ready for handoff to any developer**

---

**END OF PART 2**
