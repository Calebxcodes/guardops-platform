# STRONDIS SAAS PLATFORM UPGRADE — MASTER SPECIFICATION v1

**Document Version:** 1.0  
**Generated:** April 21, 2026  
**Target Launch:** April 30, 2026  
**Prepared For:** Caleb (Founder) + Future Development Team

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema & Separation Strategy](#database-schema--separation-strategy)
4. [Multi-Tenancy Implementation](#multi-tenancy-implementation)
5. [Payment & Billing System (Stripe Integration)](#payment--billing-system-stripe-integration)
6. [Master Admin Panel](#master-admin-panel)
7. [Onboarding & Tutorial System](#onboarding--tutorial-system)
8. [Feature Flags & Configuration](#feature-flags--configuration)
9. [API Contracts & Endpoint Changes](#api-contracts--endpoint-changes)
10. [Deployment Sequence & Git Workflow](#deployment-sequence--git-workflow)
11. [Testing Strategy](#testing-strategy)
12. [Rollback & Recovery Procedures](#rollback--recovery-procedures)

---

## EXECUTIVE SUMMARY

### What Changes

Strondis transforms from a **single-tenant SaaS platform** to a **multi-tenant, payment-enabled B2B SaaS platform** with the following additions:

| Component | Current State | New State |
|-----------|---------------|-----------|
| **Tenancy Model** | Single tenant (one security company per deployment) | Multi-tenant (each client gets isolated database + subdomain) |
| **Payments** | None | Stripe-powered auto-charge + retry logic |
| **Billing** | None | 1-month free trial → auto-charge on day 31 → monthly recurring |
| **Master Admin** | None | Separate app (`admin-master.strondis.com`) for Strondis ops |
| **Onboarding** | None | Feature-flagged video tutorials (voice-over, Strondis-branded) |
| **Data Isolation** | Single PostgreSQL database | Separate PostgreSQL database per tenant |

### Why This Matters

1. **Revenue:** You can now charge multiple customers independently
2. **Security:** Data breach in one tenant ≠ all tenants compromised
3. **Scalability:** Each tenant operates in isolation; no shared resource contention
4. **Compliance:** GDPR-ready (data export, deletion, archival per tenant)
5. **Operations:** Master panel gives you visibility + control over all tenants

### Timeline

- **Now (April 21):** Specification & architecture planning
- **April 22–29:** Implementation (backend + frontends)
- **April 30:** Deploy to production
- **May 1:** Enable payments for pilot tenants (feature flag)

---

## ARCHITECTURE OVERVIEW

### Current System (Single-Tenant)

```
┌─────────────────────────────────────────────────┐
│              VERCEL (Frontend)                  │
├──────────────────┬──────────────────────────────┤
│  Admin CRM       │  Guard App         │ Landing │
│ (React)          │ (React PWA)        │ (React) │
└────────┬─────────┴──────────┬─────────┴────┬────┘
         │                    │              │
         └────────┬───────────┴──────────────┘
                  │
              (Axios)
                  │
    ┌─────────────▼──────────────┐
    │  RAILWAY (Backend API)     │
    │  Express.js + TypeScript   │
    └────────────┬───────────────┘
                 │
    ┌────────────▼────────────┐
    │  PostgreSQL (Shared DB) │
    │  Single-tenant schema   │
    └─────────────────────────┘
```

### New System (Multi-Tenant)

```
┌──────────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend Layer)                       │
├───────────────────┬─────────────────────┬──────────────────┬────┤
│ Admin Master      │ Admin CRM           │ Guard App        │ Landing │
│ (Separate app)    │ (Tenant-specific)   │ (Tenant-specific)│ (Same)  │
│ admin-master.     │ tenant123.strondis. │ tenant123.guard- │ strondis│
│ strondis.com      │ com                 │ app.strondis.com │ .com    │
└────────┬──────────┴──────┬──────────────┴────────┬─────────┴────────┘
         │                 │                      │
    (Axios)            (Axios)                 (Axios)
         │                 │                      │
    ┌────▼─────────────────▼──────────────────────▼──────┐
    │  RAILWAY (Backend API — Single Instance)         │
    │  Express.js + TypeScript                         │
    │  ✓ Tenant detection middleware                   │
    │  ✓ Payment webhook handler                       │
    │  ✓ Stripe integration                            │
    │  ✓ Master admin routes                           │
    └────┬──────────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────┐
    │ PostgreSQL (One instance, multi-schema)  │
    │                                          │
    │ ├─ public (shared metadata)             │
    │ │  ├─ tenants (tenant registry)         │
    │ │  ├─ subscriptions (billing)           │
    │ │  ├─ payments (transaction logs)       │
    │ │  └─ audit_logs (global)               │
    │ │                                        │
    │ ├─ tenant_001 (Company A)               │
    │ │  ├─ guards                            │
    │ │  ├─ shifts                            │
    │ │  ├─ incidents                         │
    │ │  └─ ...                               │
    │ │                                        │
    │ ├─ tenant_002 (Company B)               │
    │ │  ├─ guards                            │
    │ │  ├─ shifts                            │
    │ │  └─ ...                               │
    │ │                                        │
    │ └─ tenant_NNN (Company N)               │
    │    └─ ...                               │
    └──────────────────────────────────────────┘
```

### Domain Structure

```
Landing page:               strondis.com
Master admin (you only):    admin-master.strondis.com

Per-tenant subdomains:      [tenant-slug].strondis.com
Per-tenant guard app:       [tenant-slug]-guard.strondis.com

Examples:
  Tenant: "Allied Security Ltd"
  Slug: "allied-security"
  Admin URL: https://allied-security.strondis.com
  Guard App: https://allied-security-guard.strondis.com
```

---

## DATABASE SCHEMA & SEPARATION STRATEGY

### Separation Model: PostgreSQL Multi-Schema (One DB Instance)

**Why this approach:**
- ✅ Cheaper than separate DB instances (no N PostgreSQL bills)
- ✅ Easier backups (one database, multiple schemas)
- ✅ Logical isolation (schema-level access control via PostgreSQL roles)
- ✅ Automatic provisioning via `CREATE SCHEMA` on signup
- ✅ Still isolated (one schema breach ≠ all schemas breached)

### Schema Architecture

```sql
-- SHARED METADATA SCHEMA (public)
-- Accessible to backend only, read-only from tenant apps

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.tenants (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- "allied-security"
  name VARCHAR(255) NOT NULL,         -- "Allied Security Ltd"
  email VARCHAR(255) NOT NULL,        -- tenant admin email
  status VARCHAR(50) DEFAULT 'active', -- active, paused, cancelled
  max_guards INT DEFAULT 10,          -- tier-based limit
  tier VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
  
  stripe_customer_id VARCHAR(255),    -- Strondis Stripe customer
  subscription_id VARCHAR(255),       -- Stripe subscription
  current_period_start BIGINT,        -- Unix timestamp
  current_period_end BIGINT,          -- Unix timestamp
  
  database_name VARCHAR(100),         -- "tenant_123"
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  
  CONSTRAINT unique_stripe_customer UNIQUE (stripe_customer_id)
);

CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_subscription ON public.tenants(subscription_id);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan_code VARCHAR(50),              -- 'starter', 'pro_50', 'pro_100', 'enterprise'
  price_monthly_cents BIGINT,         -- e.g., 34900 for £349
  status VARCHAR(50),                 -- active, past_due, cancelled
  current_period_start BIGINT,
  current_period_end BIGINT,
  cancel_at BIGINT,                   -- scheduled cancellation
  cancelled_at BIGINT,                -- actual cancellation time
  trial_ends_at BIGINT,               -- free trial expiry (30 days from signup)
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

CREATE TABLE IF NOT EXISTS public.payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  amount_cents BIGINT,                -- amount charged in pence
  currency VARCHAR(3) DEFAULT 'GBP',
  status VARCHAR(50),                 -- succeeded, failed, pending, refunded
  description TEXT,                   -- "Strondis SaaS — April 2026"
  
  attempted_at BIGINT,
  succeeded_at BIGINT,
  failed_at BIGINT,
  retry_count INT DEFAULT 0,
  next_retry_at BIGINT,               -- next auto-retry timestamp
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_attempted ON public.payments(attempted_at);

CREATE TABLE IF NOT EXISTS public.master_admins (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  two_fa_secret VARCHAR(255),
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'viewer',  -- viewer, editor, super_admin
  mfa_enabled BOOLEAN DEFAULT TRUE,
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  last_login BIGINT
);

CREATE INDEX idx_master_admins_email ON public.master_admins(email);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(50),             -- 'master_admin', 'tenant_admin', 'system'
  actor_id BIGINT,                    -- master_admin.id or tenant admin ID
  action VARCHAR(100),                -- 'tenant_created', 'payment_charged', 'access_revoked'
  target_type VARCHAR(50),            -- 'tenant', 'subscription', 'user'
  target_id BIGINT,
  details JSONB,                      -- extra context
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON public.audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
```

### Per-Tenant Schema (Dynamic Creation)

**On tenant signup, create a new schema:**

```sql
-- Example: tenant_123 schema
CREATE SCHEMA IF NOT EXISTS tenant_123;

-- All existing tables migrate to tenant_123 namespace
CREATE TABLE tenant_123.guards (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,  -- redundant, but useful for joins
  sia_license_number VARCHAR(50) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE TABLE tenant_123.shifts (
  id BIGSERIAL PRIMARY KEY,
  guard_id BIGINT REFERENCES tenant_123.guards(id) ON DELETE CASCADE,
  start_time BIGINT,
  end_time BIGINT,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scheduled',
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- ... and all other tables (incidents, payroll_records, etc.)
```

### Tenant Access Control (PostgreSQL Roles)

```sql
-- Create role for tenant_123 with limited access
CREATE ROLE tenant_123_user WITH PASSWORD 'secure_random_password';

-- Grant schema access (read + write)
GRANT USAGE ON SCHEMA tenant_123 TO tenant_123_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_123 TO tenant_123_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_123 TO tenant_123_user;

-- Deny access to public schema (except subscriptions/payments read)
REVOKE ALL ON SCHEMA public FROM tenant_123_user;
GRANT USAGE ON SCHEMA public TO tenant_123_user;
GRANT SELECT ON public.subscriptions TO tenant_123_user;  -- read own subscription
GRANT SELECT ON public.payments TO tenant_123_user;       -- read own payments
```

---

## MULTI-TENANCY IMPLEMENTATION

### Tenant Detection Middleware (Express.js)

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

/**
 * Detects tenant from:
 * 1. Request hostname (e.g., "allied-security.strondis.com")
 * 2. JWT token (contains tenant_id)
 * 3. Master admin routes (skip tenant detection)
 */
export async function detectTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const hostname = req.hostname;
  
  // Master admin routes (skip tenant detection)
  if (hostname === 'admin-master.strondis.com' || hostname.includes('localhost:3001')) {
    req.isMasterAdmin = true;
    return next();
  }
  
  // Extract tenant slug from subdomain
  // "allied-security.strondis.com" → "allied-security"
  const parts = hostname.split('.');
  if (parts.length < 2) {
    return res.status(400).json({ error: 'Invalid hostname' });
  }
  
  const tenantSlug = parts[0];
  
  try {
    // Look up tenant in public.tenants
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
    
    // Check if tenant is active
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: 'Tenant account is not active' });
    }
    
    // Check subscription status (if on free trial, allow; if expired and no paid subscription, deny)
    const now = Math.floor(Date.now() / 1000);
    const isOnTrial = tenant.trial_ends_at && tenant.trial_ends_at > now;
    const isSubscriptionActive = tenant.subscription_status === 'active';
    
    if (!isOnTrial && !isSubscriptionActive) {
      return res.status(403).json({ 
        error: 'Subscription expired. Please renew to continue.' 
      });
    }
    
    // Attach tenant context to request
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
    console.error('Tenant detection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Query Wrapper (Automatic Schema Selection)

**File:** `backend/src/db/pool.ts`

```typescript
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Wrapper around pg.query that automatically:
 * 1. Sets search_path to tenant schema
 * 2. Logs query + tenant for debugging
 */
export async function query(
  text: string,
  values?: any[],
  tenantId?: number
) {
  if (tenantId) {
    // Set schema for this connection
    const schemaName = `tenant_${tenantId}`;
    
    // Prepend SET search_path to query
    const fullQuery = `SET search_path TO ${schemaName}, public; ${text}`;
    
    return pool.query(fullQuery, values);
  }
  
  // Public schema queries (master admin, tenant registry, etc.)
  return pool.query(text, values);
}

export { pool };
```

### Signup Flow (New Tenant Registration)

**File:** `backend/src/routes/signupV2.ts` (NEW)

```typescript
import express, { Router } from 'express';
import { pool, query } from '../db/pool';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface SignupPayload {
  companyName: string;
  email: string;
  password: string;
  tier: 'starter' | 'professional' | 'enterprise';
}

router.post('/signup', async (req, res) => {
  const { companyName, email, password, tier } = req.body as SignupPayload;
  
  try {
    // Validate inputs
    if (!companyName || !email || !password || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }
    
    // Generate slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check if slug already exists
    const existingTenant = await pool.query(
      'SELECT id FROM public.tenants WHERE slug = $1',
      [slug]
    );
    
    if (existingTenant.rows.length > 0) {
      return res.status(409).json({ error: 'Company name already taken' });
    }
    
    // Create Stripe customer (for master account)
    const stripeCustomer = await stripe.customers.create({
      email: email,
      metadata: { company_name: companyName, slug: slug },
    });
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Determine tier config
    const tierConfig: Record<string, { maxGuards: number; priceCents: number }> = {
      starter: { maxGuards: 10, priceCents: 34900 },        // £349
      professional: { maxGuards: 50, priceCents: 69900 },   // £699
      enterprise: { maxGuards: 500, priceCents: 249900 },   // £2,499
    };
    
    const config = tierConfig[tier];
    
    // Insert tenant into public.tenants
    const tenantResult = await pool.query(
      `INSERT INTO public.tenants 
        (slug, name, email, tier, max_guards, stripe_customer_id, status, database_name)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING id`,
      [slug, companyName, email, tier, config.maxGuards, stripeCustomer.id, `tenant_${Date.now()}`]
    );
    
    const tenantId = tenantResult.rows[0].id;
    const schemaName = `tenant_${tenantId}`;
    
    // Create schema for tenant
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    
    // Copy DDL from public schema to tenant schema
    // (This would be handled by a migration script)
    await initializeTenantSchema(schemaName, tenantId);
    
    // Create initial admin user for tenant
    const tenantAdminResult = await pool.query(
      `INSERT INTO ${schemaName}.admins 
        (email, password_hash, role)
      VALUES ($1, $2, 'owner')
      RETURNING id`,
      [email, passwordHash]
    );
    
    // Create subscription with 30-day free trial
    const trialEndsAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    
    const subscriptionResult = await pool.query(
      `INSERT INTO public.subscriptions 
        (tenant_id, plan_code, price_monthly_cents, status, trial_ends_at)
      VALUES ($1, $2, $3, 'trialing', $4)
      RETURNING id`,
      [tenantId, tier, config.priceCents, trialEndsAt]
    );
    
    // Log audit event
    await pool.query(
      `INSERT INTO public.audit_logs 
        (actor_type, action, target_type, target_id, details, ip_address)
      VALUES ('system', 'tenant_created', 'tenant', $1, $2, $3)`,
      [tenantId, JSON.stringify({ slug, email, tier }), req.ip]
    );
    
    res.status(201).json({
      tenantId,
      slug,
      message: `Welcome ${companyName}! Your 30-day free trial starts now.`,
      trialEndsAt,
      adminUrl: `https://${slug}.strondis.com`,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

async function initializeTenantSchema(schemaName: string, tenantId: number) {
  // This would replicate the entire schema structure from backend/src/db/schema.ts
  // into the new tenant schema, replacing all tenant_id = $1 references with actual tenantId
  // Implementation details in schema migration script
}

export default router;
```

---

## PAYMENT & BILLING SYSTEM (STRIPE INTEGRATION)

### Billing Flow Overview

```
┌─────────────────────────────────────────────────────┐
│ TENANT SIGNS UP                                     │
│ • 30-day free trial starts                          │
│ • No payment method required yet                    │
└──────────────────┬──────────────────────────────────┘
                   │
        (30 days pass)
                   │
         ┌─────────▼──────────┐
         │ DAY 31 — AUTO CHARGE│
         │ • Trigger Stripe charge
         │ • Record in payments table
         │ • Send invoice email
         └─────────┬──────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
   SUCCESS               FAILURE
      │                         │
   ┌──▼─────────┐     ┌────────▼────────┐
   │ Subscription│     │ Mark as FAILED  │
   │ = 'active'  │     │ Retry in 3 days │
   │ Next billing│     │ Send retry email│
   │ = Day 61    │     └────────┬────────┘
   └─────────────┘              │
                        ┌───────▼────────┐
                        │ DAY 34 AUTO RETRY
                        │ Success? → Active
                        │ Failure? → Pause access
                        └────────────────┘
```

### Stripe Event Handler (Webhook)

**File:** `backend/src/routes/webhooks/stripe.ts` (NEW)

```typescript
import express, { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../../db/pool';
import { sendEmail } from '../../services/email';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] || '', webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).send('Webhook error');
  }
  
  try {
    switch (event.type) {
      // Payment succeeded
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Find tenant by Stripe customer ID
        const result = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [invoice.customer]
        );
        
        if (result.rows.length === 0) break;
        
        const tenantId = result.rows[0].id;
        
        // Update payment status
        await pool.query(
          `UPDATE public.payments 
           SET status = 'succeeded', succeeded_at = $1, updated_at = $2
           WHERE stripe_invoice_id = $3`,
          [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), invoice.id]
        );
        
        // Ensure subscription is active
        await pool.query(
          `UPDATE public.subscriptions 
           SET status = 'active'
           WHERE tenant_id = $1`,
          [tenantId]
        );
        
        // Send confirmation email
        const tenantEmail = await getTenantEmail(tenantId);
        await sendEmail(tenantEmail, 'Payment Received', 
          `Your payment of £${(invoice.total || 0) / 100} has been processed successfully.`
        );
        
        break;
      }
      
      // Payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        const result = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [invoice.customer]
        );
        
        if (result.rows.length === 0) break;
        
        const tenantId = result.rows[0].id;
        
        // Record payment failure
        await pool.query(
          `INSERT INTO public.payments (tenant_id, stripe_invoice_id, status, attempted_at)
           VALUES ($1, $2, 'failed', $3)`,
          [tenantId, invoice.id, Math.floor(Date.now() / 1000)]
        );
        
        // Schedule retry for 3 days later
        const retryAt = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60;
        
        await pool.query(
          `UPDATE public.payments 
           SET next_retry_at = $1, retry_count = retry_count + 1
           WHERE stripe_invoice_id = $2`,
          [retryAt, invoice.id]
        );
        
        // Send retry notification email
        const tenantEmail = await getTenantEmail(tenantId);
        await sendEmail(tenantEmail, 'Payment Failed — Retry Coming',
          `Your payment failed. We'll retry on ${new Date(retryAt * 1000).toDateString()}. Update your payment method if needed.`
        );
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const result = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [subscription.customer]
        );
        
        if (result.rows.length === 0) break;
        
        const tenantId = result.rows[0].id;
        
        // Mark subscription as cancelled
        await pool.query(
          `UPDATE public.subscriptions 
           SET status = 'cancelled', cancelled_at = $1
           WHERE tenant_id = $2`,
          [Math.floor(Date.now() / 1000), tenantId]
        );
        
        // TODO: Pause tenant access
        
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function getTenantEmail(tenantId: number): Promise<string> {
  const result = await pool.query(
    'SELECT email FROM public.tenants WHERE id = $1',
    [tenantId]
  );
  return result.rows[0]?.email || '';
}

export default router;
```

### Billing Cron Job (Auto-Charge on Trial Expiry)

**File:** `backend/src/services/billingCron.ts` (NEW)

```typescript
import { pool } from '../db/pool';
import Stripe from 'stripe';
import { sendEmail } from './email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * Runs daily (08:00 UTC) to:
 * 1. Check for subscriptions with trial ending today
 * 2. Charge them via Stripe
 * 3. Log payment attempt
 */
export async function runBillingCron() {
  console.log('[Billing Cron] Starting...');
  
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Find subscriptions where trial ends today
    const result = await pool.query(
      `SELECT 
        s.id, s.tenant_id, s.price_monthly_cents,
        t.name, t.email, t.stripe_customer_id
      FROM public.subscriptions s
      JOIN public.tenants t ON s.tenant_id = t.id
      WHERE s.status = 'trialing'
        AND s.trial_ends_at <= $1
        AND s.trial_ends_at > $1 - 86400`,  -- within last 24 hours
      [now]
    );
    
    for (const subscription of result.rows) {
      await chargeSubscription(subscription);
    }
    
    console.log(`[Billing Cron] Charged ${result.rows.length} subscriptions`);
  } catch (error) {
    console.error('[Billing Cron] Error:', error);
  }
}

async function chargeSubscription(subscription: any) {
  const { tenant_id, price_monthly_cents, name, email, stripe_customer_id } = subscription;
  
  try {
    // Create Stripe invoice (auto-charge)
    const invoice = await stripe.invoices.create({
      customer: stripe_customer_id,
      auto_advance: true, // auto-charge immediately
    });
    
    // Record payment in database
    await pool.query(
      `INSERT INTO public.payments 
        (tenant_id, stripe_invoice_id, amount_cents, status, attempted_at)
      VALUES ($1, $2, $3, 'pending', $4)`,
      [tenant_id, invoice.id, price_monthly_cents, now]
    );
    
    // Send invoice email
    await sendEmail(
      email,
      `Invoice from Strondis — ${new Date().toLocaleDateString()}`,
      `Your monthly invoice for ${name} is ready. Amount: £${(price_monthly_cents / 100).toFixed(2)}`
    );
    
    // Update subscription to active (assuming charge succeeds)
    // (Stripe webhook will confirm success/failure)
    await pool.query(
      `UPDATE public.subscriptions 
       SET status = 'active', current_period_start = $1, current_period_end = $2
       WHERE tenant_id = $3`,
      [now, now + 30 * 24 * 60 * 60, tenant_id]
    );
  } catch (error) {
    console.error(`[Billing Cron] Failed to charge tenant ${tenant_id}:`, error);
    
    // Mark as failed, will retry in 3 days via webhook handler
  }
}

export default { runBillingCron };
```

### Monthly Subscription Renewal (for paid subscriptions)

**File:** `backend/src/services/renewalCron.ts` (NEW)

```typescript
import { pool } from '../db/pool';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * Runs daily to renew subscriptions that have reached their period end
 */
export async function runRenewalCron() {
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Find subscriptions where current_period_end is today
    const result = await pool.query(
      `SELECT s.id, s.tenant_id, t.stripe_customer_id, s.price_monthly_cents
       FROM public.subscriptions s
       JOIN public.tenants t ON s.tenant_id = t.id
       WHERE s.status = 'active'
         AND s.current_period_end = $1
         AND s.current_period_end <= $1 + 86400`,
      [now]
    );
    
    for (const sub of result.rows) {
      // Create invoice for next month
      const invoice = await stripe.invoices.create({
        customer: sub.stripe_customer_id,
        auto_advance: true,
      });
      
      // Update subscription period
      const nextPeriodEnd = now + 30 * 24 * 60 * 60;
      
      await pool.query(
        `UPDATE public.subscriptions 
         SET current_period_start = $1, current_period_end = $2
         WHERE id = $3`,
        [now, nextPeriodEnd, sub.id]
      );
    }
    
    console.log(`[Renewal Cron] Renewed ${result.rows.length} subscriptions`);
  } catch (error) {
    console.error('[Renewal Cron] Error:', error);
  }
}
```

### Stripe Integration in Backend Startup

**File:** `backend/src/index.ts` (modifications)

```typescript
import express from 'express';
import cron from 'node-cron';
import { detectTenant } from './middleware/tenantDetection';
import { runBillingCron } from './services/billingCron';
import { runRenewalCron } from './services/renewalCron';
import stripeWebhookRouter from './routes/webhooks/stripe';
import signupRouter from './routes/signupV2';

const app = express();

// Stripe webhook (raw body, no JSON parsing)
app.use('/api/webhooks', express.raw({ type: 'application/json' }), stripeWebhookRouter);

// Parse JSON for all other routes
app.use(express.json());

// Tenant detection middleware
app.use(detectTenant);

// Mount routes
app.use('/api/signup', signupRouter);
app.use('/api/master-admin', masterAdminRouter); // see section 6

// Cron jobs
// Daily billing cron (08:00 UTC)
cron.schedule('0 8 * * *', runBillingCron, { timezone: 'UTC' });

// Daily renewal cron (08:30 UTC)
cron.schedule('30 8 * * *', runRenewalCron, { timezone: 'UTC' });

app.listen(3000, () => console.log('Backend running on port 3000'));
```

---

## MASTER ADMIN PANEL

### Architecture

**Separate React app** deployed to `admin-master.strondis.com`

**File structure:**
```
master-admin/
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
│       ├── SidebarNav.tsx
│       └── ...
├── vite.config.ts
├── vercel.json
└── package.json
```

### Key Features

#### 1. **Authentication (Master Admin)**

**Endpoint:** `POST /api/master-admin/auth/login`

```typescript
// backend/src/routes/masterAdminAuth.ts (NEW)

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const result = await pool.query(
    'SELECT * FROM public.master_admins WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const admin = result.rows[0];
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);
  
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (admin.mfa_enabled) {
    // Return partial token (MFA required)
    const partialToken = jwt.sign(
      { adminId: admin.id, mfaPending: true },
      process.env.JWT_SECRET || '',
      { expiresIn: '5m' }
    );
    
    return res.json({ requires_mfa: true, partial_token: partialToken });
  }
  
  // No MFA, return full token
  const fullToken = jwt.sign(
    { adminId: admin.id, role: admin.role },
    process.env.JWT_SECRET || '',
    { expiresIn: '24h' }
  );
  
  res.json({ token: fullToken });
});
```

#### 2. **Tenant Management Dashboard**

**Endpoint:** `GET /api/master-admin/tenants`

```typescript
router.get('/tenants', requireMasterAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id, t.slug, t.name, t.email, t.status, t.tier, t.max_guards,
        (SELECT COUNT(*) FROM ${t.id}.guards) as guard_count,
        s.status as subscription_status,
        s.current_period_end,
        (SELECT COUNT(*) FROM public.payments WHERE tenant_id = t.id AND status = 'failed') as failed_payments
      FROM public.tenants t
      LEFT JOIN public.subscriptions s ON t.id = s.tenant_id
      ORDER BY t.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Pause/Cancel tenant access
router.post('/tenants/:tenantId/pause', requireMasterAdmin, async (req, res) => {
  const { tenantId } = req.params;
  const { reason } = req.body;
  
  try {
    // Mark tenant as paused
    await pool.query(
      'UPDATE public.tenants SET status = $1 WHERE id = $2',
      ['paused', tenantId]
    );
    
    // Log audit event
    await pool.query(
      `INSERT INTO public.audit_logs 
        (actor_type, actor_id, action, target_type, target_id, details)
      VALUES ('master_admin', $1, 'tenant_paused', 'tenant', $2, $3)`,
      [req.user.adminId, tenantId, JSON.stringify({ reason })]
    );
    
    res.json({ message: 'Tenant paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause tenant' });
  }
});

// Reactivate tenant
router.post('/tenants/:tenantId/resume', requireMasterAdmin, async (req, res) => {
  const { tenantId } = req.params;
  
  try {
    await pool.query(
      'UPDATE public.tenants SET status = $1 WHERE id = $2',
      ['active', tenantId]
    );
    
    await pool.query(
      `INSERT INTO public.audit_logs 
        (actor_type, actor_id, action, target_type, target_id)
      VALUES ('master_admin', $1, 'tenant_resumed', 'tenant', $2)`,
      [req.user.adminId, tenantId]
    );
    
    res.json({ message: 'Tenant resumed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume tenant' });
  }
});
```

#### 3. **Subscription & Payment Management**

**Endpoint:** `GET /api/master-admin/subscriptions`

```typescript
router.get('/subscriptions', requireMasterAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      s.id, s.tenant_id, s.plan_code, s.price_monthly_cents, s.status,
      s.current_period_start, s.current_period_end, s.trial_ends_at,
      t.name, t.email
    FROM public.subscriptions s
    JOIN public.tenants t ON s.tenant_id = t.id
    ORDER BY s.created_at DESC
  `);
  
  res.json(result.rows);
});

router.get('/payments', requireMasterAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      p.id, p.tenant_id, p.stripe_invoice_id, p.amount_cents, 
      p.status, p.attempted_at, p.succeeded_at, p.failed_at, p.retry_count,
      t.name
    FROM public.payments p
    JOIN public.tenants t ON p.tenant_id = t.id
    WHERE p.status = 'failed' OR p.status = 'pending'
    ORDER BY p.attempted_at DESC
  `);
  
  res.json(result.rows);
});

// Process refund
router.post('/payments/:paymentId/refund', requireMasterAdmin, async (req, res) => {
  const { paymentId } = req.params;
  const { amount_cents } = req.body;
  
  try {
    // Get payment details
    const paymentResult = await pool.query(
      'SELECT stripe_charge_id FROM public.payments WHERE id = $1',
      [paymentId]
    );
    
    const stripeChargeId = paymentResult.rows[0].stripe_charge_id;
    
    // Refund via Stripe
    const refund = await stripe.refunds.create({
      charge: stripeChargeId,
      amount: amount_cents,
    });
    
    // Update payment record
    await pool.query(
      'UPDATE public.payments SET status = $1, updated_at = $2 WHERE id = $3',
      ['refunded', Math.floor(Date.now() / 1000), paymentId]
    );
    
    // Log refund
    await pool.query(
      `INSERT INTO public.audit_logs 
        (actor_type, actor_id, action, target_type, target_id, details)
      VALUES ('master_admin', $1, 'payment_refunded', 'payment', $2, $3)`,
      [req.user.adminId, paymentId, JSON.stringify({ stripeRefundId: refund.id })]
    );
    
    res.json({ message: 'Refund processed', refundId: refund.id });
  } catch (error) {
    res.status(500).json({ error: 'Refund failed' });
  }
});
```

#### 4. **Audit Logs & Activity Tracking**

**Endpoint:** `GET /api/master-admin/audit-logs`

```typescript
router.get('/audit-logs', requireMasterAdmin, async (req, res) => {
  const { action, target_type, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM public.audit_logs WHERE 1=1';
  const params = [];
  
  if (action) {
    params.push(action);
    query += ` AND action = $${params.length}`;
  }
  
  if (target_type) {
    params.push(target_type);
    query += ` AND target_type = $${params.length}`;
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  
  const result = await pool.query(query, params);
  res.json(result.rows);
});
```

#### 5. **Role-Based Access Control (RBAC)**

```typescript
// middleware/requireMasterAdmin.ts
export function requireMasterAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

export function requireRole(role: 'super_admin' | 'editor' | 'viewer') {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminRoles = { super_admin: 3, editor: 2, viewer: 1 };
    const userRoleLevel = adminRoles[req.user.role] || 0;
    const requiredLevel = adminRoles[role];
    
    if (userRoleLevel < requiredLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}
```

### Master Admin Frontend (React)

**File:** `master-admin/src/pages/Dashboard/index.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { masterAdminApi } from '../../api/masterAdminApi';

interface Tenant {
  id: number;
  name: string;
  email: string;
  status: string;
  tier: string;
  guard_count: number;
  subscription_status: string;
  failed_payments: number;
}

export default function Dashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadTenants();
  }, []);
  
  async function loadTenants() {
    try {
      const data = await masterAdminApi.getTenants();
      setTenants(data);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Master Admin Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card title="Active Tenants" value={tenants.filter(t => t.status === 'active').length} />
        <Card title="Total Revenue" value={`£${calculateTotalRevenue(tenants)}`} />
        <Card title="Failed Payments" value={tenants.reduce((sum, t) => sum + t.failed_payments, 0)} />
        <Card title="Guards Managed" value={tenants.reduce((sum, t) => sum + t.guard_count, 0)} />
      </div>
      
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2 text-left">Company</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Tier</th>
            <th className="border p-2 text-left">Guards</th>
            <th className="border p-2 text-left">Subscription</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map(tenant => (
            <tr key={tenant.id} className="border-b hover:bg-gray-50">
              <td className="border p-2">{tenant.name}</td>
              <td className="border p-2">
                <span className={`px-2 py-1 rounded text-sm ${tenant.status === 'active' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tenant.status}
                </span>
              </td>
              <td className="border p-2">{tenant.tier}</td>
              <td className="border p-2 text-center">{tenant.guard_count}</td>
              <td className="border p-2">
                <span className={`text-sm ${tenant.subscription_status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {tenant.subscription_status}
                </span>
                {tenant.failed_payments > 0 && (
                  <div className="text-red-600 text-xs">
                    ⚠️ {tenant.failed_payments} failed payments
                  </div>
                )}
              </td>
              <td className="border p-2">
                <button onClick={() => pauseTenant(tenant.id)} className="text-red-600 hover:underline text-sm mr-3">
                  Pause
                </button>
                <a href={`https://${tenant.name.toLowerCase().replace(/\s+/g, '-')}.strondis.com`} target="_blank" className="text-blue-600 hover:underline text-sm">
                  Visit
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-gray-600 text-sm">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function calculateTotalRevenue(tenants: Tenant[]): number {
  // Calculate based on subscription status + tier pricing
  return 0; // Placeholder
}

async function pauseTenant(tenantId: number) {
  if (!confirm('Pause this tenant?')) return;
  await masterAdminApi.pauseTenant(tenantId, { reason: 'Manual suspension' });
  window.location.reload();
}
```

---

## ONBOARDING & TUTORIAL SYSTEM

### Video Generation (Placeholder — Use Existing Provider)

For MVP, we'll use **text-based tooltips + feature flag** to toggle video availability later.

**File:** `frontend/src/hooks/useOnboarding.ts`

```typescript
import { useEffect, useState } from 'react';
import { featureFlagsApi } from '../api';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  steps: string[];
  completed: boolean;
}

export function useOnboarding() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [videosEnabled, setVideosEnabled] = useState(false);
  
  useEffect(() => {
    loadTutorials();
  }, []);
  
  async function loadTutorials() {
    try {
      const flags = await featureFlagsApi.getFlags();
      setVideosEnabled(flags.onboarding_videos_enabled ?? false);
      
      // Define tutorial sequence
      const tutorialSequence: Tutorial[] = [
        {
          id: 'dashboard-overview',
          title: 'Dashboard Overview',
          description: 'Learn the basics of your admin dashboard',
          steps: [
            'The Dashboard shows your team at a glance',
            'Use the sidebar to navigate between sections',
            'Click on any guard to view details',
          ],
          completed: false,
        },
        {
          id: 'scheduling',
          title: 'Creating Shifts',
          description: 'Schedule your guards for upcoming assignments',
          steps: [
            'Go to Scheduling > New Shift',
            'Select guard and date/time',
            'Add location and assignment type',
            'Click Create to publish',
          ],
          completed: false,
        },
        {
          id: 'gps-tracking',
          title: 'Real-Time GPS Tracking',
          description: 'Monitor guard locations in real-time',
          steps: [
            'Open the Map view from the sidebar',
            'See live locations of all active guards',
            'Click a guard to view their shift details',
          ],
          completed: false,
        },
        {
          id: 'payroll',
          title: 'Payroll Management',
          description: 'Calculate pay and process payroll',
          steps: [
            'Go to Payroll > Monthly Report',
            'Review hours and any manual adjustments',
            'Click Process to generate invoices',
          ],
          completed: false,
        },
      ];
      
      setTutorials(tutorialSequence);
    } catch (error) {
      console.error('Failed to load tutorials:', error);
    }
  }
  
  function markTutorialComplete(tutorialId: string) {
    setTutorials(tutorials.map(t =>
      t.id === tutorialId ? { ...t, completed: true } : t
    ));
  }
  
  return { tutorials, videosEnabled, markTutorialComplete };
}
```

### Onboarding Modal Component

**File:** `frontend/src/components/OnboardingModal.tsx`

```typescript
import React, { useState } from 'react';

interface Props {
  tutorial: any;
  onComplete: () => void;
  onSkip: () => void;
  videosEnabled: boolean;
}

export function OnboardingModal({ tutorial, onComplete, onSkip, videosEnabled }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        {videosEnabled && tutorial.videoUrl && (
          <video 
            className="w-full rounded mb-4"
            controls
            src={tutorial.videoUrl}
          />
        )}
        
        <h2 className="text-2xl font-bold mb-4">{tutorial.title}</h2>
        <p className="text-gray-600 mb-6">{tutorial.description}</p>
        
        <div className="space-y-3 mb-6">
          {tutorial.steps.map((step, idx) => (
            <div key={idx} className={`flex items-start ${idx === currentStep ? 'font-bold' : 'opacity-50'}`}>
              <div className="mr-3 flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">
                {idx + 1}
              </div>
              <p className="mt-0.5">{step}</p>
            </div>
          ))}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={onComplete}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Feature Flag for Onboarding Videos

**Endpoint:** `GET /api/feature-flags`

```typescript
// backend/src/routes/featureFlags.ts (NEW)

router.get('/flags', (req, res) => {
  res.json({
    // Onboarding
    onboarding_videos_enabled: process.env.FEATURE_FLAG_ONBOARDING_VIDEOS === 'true',
    
    // Payments
    stripe_payments_enabled: process.env.FEATURE_FLAG_STRIPE_ENABLED === 'true',
    
    // Multi-tenancy
    multi_tenancy_enabled: process.env.FEATURE_FLAG_MULTI_TENANCY === 'true',
    
    // Other features
    websocket_messaging_enabled: process.env.FEATURE_FLAG_WEBSOCKETS === 'true',
  });
});
```

---

**[Document continues in next part due to length...]**

---

## END OF PART 1

This is the **first half** of the master specification. The document covers:

✅ Architecture overview  
✅ Database schema & multi-schema strategy  
✅ Multi-tenancy implementation  
✅ Payment & billing (Stripe)  
✅ Master admin panel  
✅ Onboarding system  

**Next sections** (Part 2, generated next):

- Feature flags & configuration  
- API contracts & endpoint changes  
- Deployment sequence & git workflow  
- Testing strategy  
- Rollback procedures  

---

## WHAT'S NEXT FOR YOU

**Right now**, review Part 1 and confirm:

1. **Database isolation strategy:** Does separate PostgreSQL schema per tenant meet your security requirements?
2. **Master admin location:** Confirmed as separate app (`admin-master.strondis.com`). Good?
3. **Stripe billing:** One Stripe account (Strondis) manages all tenant charges. Clear?

**Once confirmed**, I'll generate:
- **Part 2:** API contracts, deployment sequence, testing  
- **RFC #1:** Stripe Integration (detailed webhook handling, retry logic)  
- **RFC #2:** Multi-Tenancy Architecture (schema provisioning, isolation guarantees)  
- **RFC #3:** Onboarding System (video generation strategy, feature flag mechanism)  
- **Implementation Roadmap:** Exact upgrade numbers, file-by-file changes, deploy sequence

---

**Save this document.** Pass it to any developer and they'll have full context without asking you a single question.
