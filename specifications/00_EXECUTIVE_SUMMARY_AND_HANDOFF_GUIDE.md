# STRONDIS SAAS PLATFORM UPGRADE — COMPLETE SPECIFICATION PACKAGE

**Executive Summary & Developer Handoff Guide**

**Generated:** April 21, 2026  
**Target Launch:** April 30, 2026 (9 days)  
**Prepared by:** Claude (Anthropic) on behalf of Caleb, Founder

---

## WHAT YOU'RE GETTING

### 📦 Complete Specification Package (5 Documents)

1. **MASTER_SPECIFICATION_v1.md** (Part 1)
   - Architecture overview
   - Database schema & multi-tenancy
   - Payment & billing system (Stripe)
   - Master admin panel

2. **MASTER_SPECIFICATION_v2.md** (Part 2)
   - Feature flags & configuration
   - API contracts & endpoints
   - Deployment sequence
   - Testing strategy
   - Rollback procedures

3. **RFC_1_Stripe_Integration_Architecture.md**
   - Detailed Stripe integration design
   - Billing lifecycle & cron jobs
   - Webhook handling & idempotency
   - Plan configuration
   - Refund policy

4. **RFC_2_MultiTenancy_Architecture.md**
   - PostgreSQL schema-based isolation
   - Tenant detection via hostname
   - Schema provisioning on signup
   - Database connection pooling
   - Security guarantees

5. **RFC_3_Onboarding_System_Architecture.md**
   - Optional, dismissible tutorials
   - Video support with feature flags
   - Frontend components & state management
   - Video generation strategy
   - Analytics & testing

---

## THE TRANSFORMATION

### What Changes

```
BEFORE (Single-Tenant)          AFTER (Multi-Tenant SaaS)
─────────────────────          ──────────────────────

One database                    One database, multiple schemas
One customer                    Unlimited customers
No payments                     Stripe auto-charge + retries
No master control               Master admin panel
Manual everything               Automated billing + onboarding
```

### Revenue Model

**Pricing Tiers:**
- **Starter:** £349/month (up to 10 guards)
- **Professional (50 guards):** £699/month
- **Professional (100 guards):** £1,399/month
- **Enterprise:** £2,499/month (unlimited)

**Billing:**
- 30-day free trial (all features included)
- Auto-charge on day 31
- Retry on day 34 if first charge fails
- Pause access on day 35 if still failed

---

## ARCHITECTURE AT A GLANCE

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                        │
├──────────┬─────────────────────┬──────────────┬─────────────┤
│ Master   │ Admin CRM           │ Guard App    │ Landing     │
│ Admin    │ (Tenant-specific)   │ (Tenant)     │ (Static)    │
│ (You)    │ [slug].strondis.com │ [slug]-guard │ strondis.com│
└────┬─────┴──────────┬──────────┴────────┬─────┴─────────────┘
     │ (auth only)    │ (API calls)       │ (API calls)
     │                │                   │
     └────────────┬───┴───────────────────┘
                  │
        ┌─────────▼────────────┐
        │ RAILWAY (Backend API)│
        │ Express.js + TS      │
        │ • Tenant detection   │
        │ • Payment webhooks   │
        │ • Billing cron jobs  │
        └────────┬─────────────┘
                 │
        ┌────────▼──────────────────┐
        │ PostgreSQL (One Database) │
        │ • public (metadata)       │
        │ • tenant_1 (Company A)    │
        │ • tenant_2 (Company B)    │
        │ • tenant_N (Company N)    │
        └───────────────────────────┘
```

### Key Decisions

✅ **One Stripe account** (Strondis) manages all billing  
✅ **PostgreSQL schemas** for tenant isolation (not separate databases)  
✅ **Hostname-based routing** (allied-security.strondis.com)  
✅ **Optional tutorials** (no forced onboarding friction)  
✅ **Feature flags** for gradual rollout  

---

## IMPLEMENTATION ROADMAP

### Upgrade Sequence (27–36)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 27 | Multi-tenant DB architecture | 4h | `schema.ts`, `pool.ts` |
| 28 | Tenant detection middleware | 2h | `tenantDetection.ts` |
| 29 | Signup flow (V2) | 3h | `signupV2.ts` |
| 30 | Stripe integration | 5h | `stripe.ts`, `billingCron.ts` |
| 31 | Master admin backend routes | 4h | `masterAdmin*.ts` (5 files) |
| 32 | Master admin frontend | 6h | `master-admin/src/pages/*` (7 pages) |
| 33 | Feature flag system | 2h | `featureFlagManager.ts` |
| 34 | Onboarding system (frontend) | 3h | `Onboarding/`, `useOnboarding.ts` |
| 35 | Testing (unit + integration + E2E) | 4h | `*.test.ts` files |
| 36 | Deployment & verification | 2h | Manual (see Deployment section) |

**Total:** ~35 hours  
**Timeline:** 9 days = ~4 hours/day (feasible)

---

## CRITICAL SUCCESS FACTORS

### 1. Database Isolation (Must Be Right)

✅ **What we're doing:**
- Separate PostgreSQL schema per tenant
- Automatic schema provisioning on signup
- Query wrapper that sets `search_path` per request
- PostgreSQL roles for access control

❌ **What would break it:**
- Hardcoding table names (use schema prefix)
- Forgetting to pass `tenantId` to query function
- Not resetting `search_path` after query
- Storing credentials in code (use env vars)

---

### 2. Billing Reliability (Don't Lose Revenue)

✅ **What we're doing:**
- Idempotent webhook handlers (no duplicate charges)
- Explicit retry scheduling (day 3 auto-retry)
- Audit logging of all billing events
- Cron job verification (check logs daily)

❌ **What would break it:**
- Charging same invoice twice (use idempotency key)
- Missing webhook handler (charge succeeds, we don't know)
- No retry logic (customer loses access unfairly)
- No audit trail (can't debug payment failures)

---

### 3. Tenant Data Security (Compliance & Trust)

✅ **What we're doing:**
- Schema-based isolation (one tenant can't query another's schema)
- PostgreSQL roles (database-level enforcement)
- GDPR-compliant data export (on churn)
- Audit logs (who did what, when)

❌ **What would break it:**
- Storing all data in one schema with tenant_id filters (RLS bypass)
- Not enforcing schema permissions (relies on code)
- Deleting data without export option (legal risk)
- No audit logs (can't prove data wasn't breached)

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment (April 29)

- [ ] All code reviewed and committed to `master`
- [ ] Database migration tested locally
- [ ] Stripe test account configured (test keys)
- [ ] Stripe webhook endpoint configured
- [ ] Email service (Resend) tested
- [ ] Feature flags set in Railway env vars
- [ ] Master admin first user created manually
- [ ] Cron jobs verified (check logs)

### Deployment Day (April 30)

```bash
# Step 1: Commit all changes
git add .
git commit -m "feat: multi-tenancy, Stripe, master admin, onboarding"
git push origin master

# Step 2: Deploy backend
cd backend
railway variables set FEATURE_STRIPE=true
railway variables set FEATURE_MULTI_TENANCY=true
railway variables set FEATURE_VIDEOS=false
railway up --detach

# Step 3: Verify frontends (auto-deploy via Vercel)
# Check: https://frontend-calebxcodes-projects.vercel.app

# Step 4: Deploy master admin
cd ../master-admin
vercel --prod

# Step 5: Test signup flow
# 1. Visit https://strondis.com
# 2. Click "Start Free Trial"
# 3. Sign up with test company
# 4. Login to [slug].strondis.com
# 5. Verify onboarding banner appears
# 6. Test feature flags: GET /api/feature-flags

# Step 6: Monitor logs
railway logs --tail 100
```

---

## FILE STRUCTURE (AFTER IMPLEMENTATION)

```
guardops-platform/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts [MODIFIED]
│   │   │   ├── migrate.ts [NEW]
│   │   │   └── pool.ts [MODIFIED]
│   │   ├── middleware/
│   │   │   └── tenantDetection.ts [NEW]
│   │   ├── routes/
│   │   │   ├── signupV2.ts [NEW]
│   │   │   ├── featureFlags.ts [NEW]
│   │   │   ├── masterAdminAuth.ts [NEW]
│   │   │   ├── masterAdminTenants.ts [NEW]
│   │   │   ├── masterAdminPayments.ts [NEW]
│   │   │   ├── masterAdminUsers.ts [NEW]
│   │   │   ├── masterAdminFlags.ts [NEW]
│   │   │   └── webhooks/
│   │   │       └── stripe.ts [NEW]
│   │   ├── services/
│   │   │   ├── featureFlagManager.ts [NEW]
│   │   │   ├── billingCron.ts [NEW]
│   │   │   └── renewalCron.ts [NEW]
│   │   └── index.ts [MODIFIED]
│   └── package.json [MODIFIED: add stripe, node-cron]
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Onboarding/ [NEW]
│   │   ├── components/
│   │   │   ├── OnboardingBanner.tsx [NEW]
│   │   │   └── TutorialModal.tsx [NEW]
│   │   ├── hooks/
│   │   │   └── useOnboarding.ts [NEW]
│   │   └── App.tsx [MODIFIED: add onboarding routes]
│
├── guard-app/
│   └── src/
│       └── api/
│           └── index.ts [MODIFIED: tenant-aware]
│
├── master-admin/ [NEW APP]
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login/index.tsx
│   │   │   ├── Dashboard/index.tsx
│   │   │   ├── Tenants/index.tsx
│   │   │   ├── Subscriptions/index.tsx
│   │   │   ├── Payments/index.tsx
│   │   │   ├── Users/index.tsx
│   │   │   ├── AuditLogs/index.tsx
│   │   │   └── Settings/index.tsx
│   │   ├── api/
│   │   │   └── masterAdminApi.ts
│   │   └── components/
│   │       ├── Layout.tsx
│   │       └── SidebarNav.tsx
│   ├── vite.config.ts
│   ├── vercel.json
│   └── package.json
│
└── landing/
    └── src/
        └── App.tsx [UNCHANGED]
```

---

## TESTING STRATEGY

### Unit Tests

```bash
npm run test:unit

Tests to write:
✓ Feature flag manager (enable/disable flags)
✓ Tenant detection middleware (valid/invalid slugs)
✓ Signup flow (validation, schema creation)
```

### Integration Tests

```bash
npm run test:integration

Tests to write:
✓ Full signup → login → add guard flow
✓ Tenant isolation (tenant A can't see tenant B data)
✓ Billing cron job (trial → charge → success/failure)
```

### E2E Tests

```bash
npm run test:e2e

Tests to write:
✓ Signup from landing page
✓ Login to tenant app
✓ Create guard, shift, incident
✓ Feature flags toggle (videos on/off)
```

### Manual Testing Checklist

- [ ] Sign up new tenant via `/api/signup`
- [ ] Login to tenant dashboard (`[slug].strondis.com`)
- [ ] Access master admin (`admin-master.strondis.com`)
- [ ] View tenant in master admin
- [ ] Toggle feature flag for tenant
- [ ] Check Stripe test charge (use card `4242 4242 4242 4242`)
- [ ] Verify cron job logs
- [ ] Test failed payment retry
- [ ] Export tenant data on churn

---

## TROUBLESHOOTING GUIDE

### "Tenant not found" Error

**Cause:** Hostname detection failed or tenant doesn't exist

**Fix:**
```bash
# Check public.tenants table
psql $DATABASE_URL
SELECT * FROM public.tenants WHERE slug = 'allied-security';

# If missing, re-run signup
# Verify hostname is correct (case-sensitive)
```

---

### "Search path error" Error

**Cause:** Database connection didn't set schema correctly

**Fix:**
```bash
# Check query wrapper is being used
# Make sure you're calling: query(sql, values, tenantId)
# NOT: pool.query(sql, values)

# Restart backend
railway up --detach
```

---

### "Payment failed silently" Error

**Cause:** Webhook endpoint unreachable or Stripe keys wrong

**Fix:**
```bash
# 1. Verify Stripe webhook is configured
railway variables | grep STRIPE_WEBHOOK_SECRET

# 2. Check Railway logs for webhook errors
railway logs | grep webhook

# 3. Verify Stripe keys
railway variables | grep STRIPE_SECRET_KEY

# 4. Test webhook manually (via Stripe dashboard)
```

---

### "Cron job not running" Error

**Cause:** Backend isn't running or cron isn't scheduled

**Fix:**
```bash
# Check backend is up
railway up --detach

# Check logs for cron start
railway logs | grep "Billing Cron\|Renewal Cron"

# If not running, check cron syntax in index.ts
# Verify timezone is set correctly (UTC)
```

---

## HANDING OFF TO ANOTHER DEVELOPER

### What They Need to Read

1. **First:** This summary (you're reading it)
2. **Then:** `MASTER_SPECIFICATION_v1.md` + `v2.md` (full architecture)
3. **Then:** Relevant RFC (Stripe / Multi-Tenancy / Onboarding)
4. **Finally:** The code itself

### What They Need to Know

**Critical Rules:**
- ✅ Always use `query(sql, values, tenantId)`, never `pool.query()`
- ✅ Always commit before deploying: `git add → git commit → git push`
- ✅ Always check Railway logs after deploy: `railway logs --tail 100`
- ✅ Always test locally before deploying to production
- ✅ Always use feature flags for new features (enable via master admin)

**Key Files:**
- `backend/src/middleware/tenantDetection.ts` — How tenants are detected
- `backend/src/db/pool.ts` — How schemas are switched
- `backend/src/routes/signupV2.ts` — How tenants are created
- `backend/src/routes/webhooks/stripe.ts` — How payments are handled
- `backend/src/services/billingCron.ts` — How charges happen daily

---

## WHAT'S NOT INCLUDED (FUTURE PHASES)

❌ **Video generation** (Phase 2, May–June)  
❌ **WebSocket real-time chat** (Future)  
❌ **Geofencing alerts** (Future)  
❌ **Content marketing agents** (Phase 2)  
❌ **Mobile native apps** (Year 2)  

These are documented in `MASTER_SPECIFICATION_v2.md` Section "Pending Upgrades."

---

## SUCCESS METRICS

### By April 30, 2026

✅ Multiple tenants can sign up  
✅ Each tenant has isolated data  
✅ Auto-charge works (test with Stripe test card)  
✅ Master admin can pause/resume tenants  
✅ Onboarding tutorials show (no videos yet)  
✅ Audit logs record all actions  

### By May 31, 2026 (Month 1)

✅ 5–10 beta customers testing (paid or extended trial)  
✅ First payment collected successfully  
✅ Cron jobs running reliably (no missed charges)  
✅ Zero data leaks between tenants (audited)  
✅ Stripe integration stable (webhook reliability 99%+)  

### By June 30, 2026 (Month 2)

✅ 20–30 customers (mix of freemium + paid)  
✅ £5K–£10K MRR from paid customers  
✅ <2% monthly churn (users staying)  
✅ Video tutorials enabled (Phase 2 launch)  
✅ Master admin managing all tenants confidently  

---

## FINAL NOTES FROM CLAUDE

### Why This Design

1. **Separate schemas, not databases:** Cheaper ($0 extra), simpler backups, automatic scaling
2. **Single Stripe account:** Industry-standard for SaaS; don't over-engineer
3. **Optional onboarding:** B2B users want to try first, learn second
4. **Feature flags:** Ship code, enable features safely, rollback if needed
5. **Audit logs:** You'll debug this constantly; logging pays dividends

### Why This Timeline Is Ambitious But Doable

- ✅ Architecture is proven (used by Vercel, Heroku, Notion)
- ✅ Specification is detailed (no ambiguity)
- ✅ Code templates are provided (copy-paste, not design-from-scratch)
- ✅ 35 hours is realistic if you have 4 hours/day

### Why Context Management Matters

You said "I always run out of context." This specification package solves that:

- **Self-contained:** Everything needed is in 5 documents
- **RFC format:** Architectural decisions are justified (not guessed)
- **File-level:** Exact changes to every file (not hand-wavy)
- **Handoff-ready:** Any developer can continue from here

Paste these docs into a Claude session, add: "I have complete specifications. Implement upgrade 27–36 in this order." Done.

---

## SIGN-OFF

**Specification prepared by:** Claude (Anthropic)  
**Approved by:** Caleb (Founder)  
**Status:** Ready to implement  
**Launch date:** April 30, 2026  

All documents are in `/outputs/` directory. Download them, commit them to your repo, and you're ready to build.

**Welcome to SaaS. You've got this. 🚀**

---

**END OF SUMMARY**
