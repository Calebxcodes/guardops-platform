# RFC #1: STRIPE INTEGRATION ARCHITECTURE

**Title:** Per-Tenant Billing with Centralized Payment Processing  
**Status:** Approved  
**Last Updated:** April 21, 2026  
**Owner:** Strondis Engineering Team

---

## ABSTRACT

This RFC documents the design for integrating Stripe into the Strondis SaaS platform with the following goals:

1. **Centralized billing:** Strondis manages one Stripe account; tenants don't need their own
2. **Automated charging:** Auto-charge after 30-day free trial, with retry logic
3. **Transparent invoicing:** Tenants receive clear, trackable invoices
4. **Webhook reliability:** Handle Stripe events with idempotency guarantees

---

## DECISION: ONE STRIPE ACCOUNT (STRONDIS) vs. PER-TENANT ACCOUNTS

### Option A: Single Strondis Stripe Account (CHOSEN)

**Stripe Account Setup:**
- One account: `sk_live_...` (for production)
- Strondis is the merchant
- Each tenant is a `Stripe Customer` in the same account

**Flow:**
```
Tenant signup
    ↓
Create Stripe Customer (email, metadata with tenant_id)
    ↓
Store stripe_customer_id in public.tenants
    ↓
On day 31: Create invoice for that customer
    ↓
Invoice routed to Strondis bank account
    ↓
Strondis tracks revenue by tenant_id in database
```

**Pros:**
- ✅ Single webhook endpoint (simpler)
- ✅ Unified revenue reporting (one Stripe dashboard)
- ✅ Easier payout reconciliation
- ✅ Cheaper (no multi-account overhead)
- ✅ Matches industry standard (SaaS platforms don't give tenants separate Stripe)

**Cons:**
- ❌ Tenants don't see their Stripe account (less transparency for them)
- ❌ All revenue in one place (slightly more audit burden)

### Option B: Per-Tenant Stripe Accounts (Stripe Connect)

**Setup:**
- Each tenant creates their own Stripe account (or we auto-create)
- Strondis uses Stripe Connect to charge them
- Funds go directly to tenant's Stripe, then we take commission

**Pros:**
- ✅ Tenants have full Stripe visibility
- ✅ Clear separation of accounts

**Cons:**
- ❌ Requires Stripe Connect (more complex)
- ❌ Requires tenant Stripe API keys (security burden on them)
- ❌ Higher webhook complexity (manage N Stripe accounts)
- ❌ Slower onboarding (tenant must create Stripe account first)
- ❌ Non-standard for B2B SaaS (marketplace model, not SaaS model)

### **Decision: Option A (Single Strondis Account)**

**Why:** You're not a marketplace; you're a SaaS platform. Standard practice is Strondis manages billing, tenants trust you. This also simplifies your implementation significantly.

---

## BILLING LIFECYCLE

### Timeline

```
DAY 0: Tenant signs up
├─ Create subscription record (status = 'trialing')
├─ Set trial_ends_at = now + 30 days
└─ No charge yet

DAY 31: Automatic charge
├─ Cron job detects trial_ends_at passed
├─ Create Stripe invoice (auto_advance = true)
├─ Stripe attempts charge immediately
├─ Webhook: invoice.payment_succeeded OR invoice.payment_failed
└─ Update subscription status

IF PAYMENT FAILED:
├─ Update payments table (status = 'failed')
├─ Set next_retry_at = now + 3 days
├─ Send email: "Payment failed, retrying in 3 days"
└─ Tenant still has access (grace period)

DAY 34: Automatic retry (if initial failed)
├─ Cron job retries failed payment
├─ If succeeds: mark payment as succeeded, extend access
├─ If fails again: Pause tenant access immediately
│  └─ Send email: "Access paused due to payment failure"
└─ No more automatic retries after this

DAY 61 (if paid): Next monthly charge
├─ Create invoice for next period
├─ Repeat payment flow
└─ If fails: retry on day 64, then pause

TENANT CHURN PATH:
├─ Tenant cancels subscription
├─ Stripe sets subscription.status = 'cancelled'
├─ Webhook: customer.subscription.deleted
├─ We mark as 'cancelled' in database
├─ On next day: Access is revoked
└─ Data: tenant can export before day 7
```

---

## DATABASE SCHEMA DECISIONS

### Subscriptions Table

```sql
CREATE TABLE public.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_subscription_id VARCHAR(255) UNIQUE,      -- Stripe subscription object ID
  
  -- Plan/pricing
  plan_code VARCHAR(50) NOT NULL,                  -- 'starter', 'pro_50', 'pro_100', 'enterprise'
  price_monthly_cents BIGINT NOT NULL,             -- e.g., 34900 = £349.00
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'trialing',           -- 'trialing', 'active', 'past_due', 'cancelled'
  
  -- Period tracking
  current_period_start BIGINT,                     -- Unix timestamp (when current billing period started)
  current_period_end BIGINT,                       -- Unix timestamp (when current billing period ends)
  trial_ends_at BIGINT,                            -- When free trial expires
  
  -- Cancellation
  cancel_at BIGINT,                                -- Scheduled cancellation date (if requested)
  cancelled_at BIGINT,                             -- Actual cancellation timestamp
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_ends ON subscriptions(trial_ends_at);
```

**Key decisions:**
- `stripe_subscription_id`: Stored for idempotency (if webhook is retried, we can match)
- `trial_ends_at`: Used by cron job to trigger first charge
- `status`: Mirrors Stripe subscription status for quick queries
- `current_period_start/end`: Calculate next billing date without querying Stripe

### Payments Table (Transaction Log)

```sql
CREATE TABLE public.payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe invoice ID
  stripe_charge_id VARCHAR(255),                   -- Stripe charge ID (if charged)
  
  -- Amount
  amount_cents BIGINT NOT NULL,                    -- 34900 = £349.00
  currency VARCHAR(3) DEFAULT 'GBP',
  
  -- Status
  status VARCHAR(50) NOT NULL,                     -- 'pending', 'succeeded', 'failed', 'refunded'
  
  -- Timing
  attempted_at BIGINT NOT NULL,                    -- When charge was first attempted
  succeeded_at BIGINT,                             -- When it succeeded
  failed_at BIGINT,                                -- When it first failed
  
  -- Retry logic
  retry_count INT DEFAULT 0,                       -- How many times we've retried
  next_retry_at BIGINT,                            -- When to retry if failed (day 3)
  
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_invoice ON payments(stripe_invoice_id);
```

**Key decisions:**
- `retry_count`: Limits retries (don't retry infinitely)
- `next_retry_at`: Explicit retry scheduling (allows manual intervention)
- `stripe_invoice_id`: Idempotency key (Stripe webhook may be called multiple times)

---

## WEBHOOK HANDLER DESIGN

### Idempotency Requirement

**Problem:** Stripe may send the same webhook event multiple times (network issues, retries).

**Solution:** Use `stripe_invoice_id` as idempotency key.

```typescript
// When webhook arrives
const invoiceId = event.data.object.id;

// Check if we already processed this invoice
const existing = await pool.query(
  'SELECT id FROM public.payments WHERE stripe_invoice_id = $1',
  [invoiceId]
);

if (existing.rows.length > 0) {
  // Already processed, return success (idempotent)
  return res.json({ received: true, alreadyProcessed: true });
}

// New invoice, process it
// ...
```

### Event Handling

**Events we listen to:**

1. **invoice.payment_succeeded**
   - Indicates a charge succeeded
   - Update `payments.status = 'succeeded'`, `succeeded_at = now`
   - Update `subscriptions.status = 'active'`
   - Send confirmation email

2. **invoice.payment_failed**
   - Indicates a charge failed
   - Update `payments.status = 'failed'`, `failed_at = now`
   - Set `payments.next_retry_at = now + 3 days`
   - DON'T revoke access yet (grace period)
   - Send "payment failed, we'll retry" email

3. **customer.subscription.deleted**
   - Indicates subscription was cancelled
   - Update `subscriptions.status = 'cancelled'`, `cancelled_at = now`
   - Tenant loses access after 24 hours

**Events we ignore:**
- `invoice.created` — We create it; don't need webhook confirmation
- `invoice.updated` — Not relevant to our flow
- `charge.succeeded` — Redundant (we handle via invoice events)

---

## BILLING CRON JOB DESIGN

### Daily Billing Cron

**Run at:** 08:00 UTC daily (configurable)

**Logic:**

```typescript
export async function runBillingCron() {
  const now = Math.floor(Date.now() / 1000);
  
  // 1. Find subscriptions where trial ends today
  const triallingSubscriptions = await pool.query(`
    SELECT s.id, s.tenant_id, s.price_monthly_cents, t.stripe_customer_id, t.email
    FROM public.subscriptions s
    JOIN public.tenants t ON s.tenant_id = t.id
    WHERE s.status = 'trialing'
      AND s.trial_ends_at > $1 - 86400
      AND s.trial_ends_at <= $1
  `, [now]);
  
  // 2. For each, create a Stripe invoice (auto-charge)
  for (const sub of triallingSubscriptions.rows) {
    try {
      const invoice = await stripe.invoices.create({
        customer: sub.stripe_customer_id,
        auto_advance: true,  // Auto-charge immediately
        description: `Strondis SaaS — ${monthYear(now)}`,
      });
      
      // Record in payments table
      await pool.query(
        `INSERT INTO public.payments (tenant_id, stripe_invoice_id, amount_cents, status, attempted_at)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [sub.tenant_id, invoice.id, sub.price_monthly_cents, now]
      );
      
      // Stripe will call our webhook (invoice.payment_succeeded or invoice.payment_failed)
      
    } catch (error) {
      console.error(`[Billing Cron] Failed to charge tenant ${sub.tenant_id}:`, error);
      // Don't throw; continue with next tenant
    }
  }
  
  // 3. Find subscriptions where next_retry_at is today
  const failedPayments = await pool.query(`
    SELECT p.stripe_invoice_id, p.tenant_id, t.stripe_customer_id, p.amount_cents
    FROM public.payments p
    JOIN public.tenants t ON p.tenant_id = t.id
    WHERE p.status = 'failed'
      AND p.next_retry_at > $1 - 86400
      AND p.next_retry_at <= $1
      AND p.retry_count < 2  -- Max 2 attempts (initial + 1 retry)
  `, [now]);
  
  // 4. For each, retry the charge
  for (const payment of failedPayments.rows) {
    try {
      // Create a new invoice (Stripe doesn't retry old invoices)
      const newInvoice = await stripe.invoices.create({
        customer: payment.stripe_customer_id,
        auto_advance: true,
        description: `Strondis SaaS — Retry for ${monthYear(now - 3*86400)}`,
      });
      
      // Record retry attempt
      await pool.query(
        `INSERT INTO public.payments (tenant_id, stripe_invoice_id, amount_cents, status, attempted_at)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [payment.tenant_id, newInvoice.id, payment.amount_cents, now]
      );
      
    } catch (error) {
      console.error(`[Billing Cron] Retry failed for tenant ${payment.tenant_id}:`, error);
    }
  }
  
  console.log(`[Billing Cron] Processed ${triallingSubscriptions.rows.length} trials, ${failedPayments.rows.length} retries`);
}
```

### Access Revocation Cron

**Run at:** 09:00 UTC daily (1 hour after billing cron)

**Logic:**

```typescript
export async function revokeAccessCron() {
  const now = Math.floor(Date.now() / 1000);
  
  // Find tenants with status 'active' but subscription failed 2x
  const failedTenants = await pool.query(`
    SELECT DISTINCT t.id, t.name
    FROM public.tenants t
    WHERE t.status = 'active'
      AND (
        -- Subscription is cancelled
        (SELECT status FROM public.subscriptions WHERE tenant_id = t.id LIMIT 1) = 'cancelled'
        
        -- OR trial expired and latest payment failed
        OR (
          (SELECT status FROM public.subscriptions WHERE tenant_id = t.id LIMIT 1) = 'past_due'
          AND (SELECT retry_count FROM public.payments WHERE tenant_id = t.id ORDER BY attempted_at DESC LIMIT 1) >= 2
        )
      )
  `);
  
  for (const tenant of failedTenants.rows) {
    // Pause access
    await pool.query(
      'UPDATE public.tenants SET status = $1 WHERE id = $2',
      ['paused', tenant.id]
    );
    
    // Send notification
    const tenantEmail = await getTenantEmail(tenant.id);
    await sendEmail(tenantEmail, 'Access Paused — Payment Required',
      `Your Strondis access has been paused due to failed payment(s). Please update your payment method.`
    );
  }
}
```

---

## PLAN CONFIGURATION

### Tier Structure

```typescript
const tiers = {
  starter: {
    code: 'starter',
    maxGuards: 10,
    priceMonthly: 34900,      // £349.00
    priceAnnual: 349900,      // £3,499.00 (20% discount)
    features: [
      'Up to 10 guards',
      'Scheduling',
      'GPS tracking',
      'Basic payroll',
      'Email support'
    ]
  },
  professional_50: {
    code: 'professional_50',
    maxGuards: 50,
    priceMonthly: 69900,       // £699.00
    priceAnnual: 699900,       // £6,999.00 (20% discount)
    features: [
      'Up to 50 guards',
      '...+ all of Starter',
      'Advanced payroll',
      'Compliance reporting',
      'Priority support'
    ]
  },
  professional_100: {
    code: 'professional_100',
    maxGuards: 100,
    priceMonthly: 139900,      // £1,399.00
    priceAnnual: 1399900,      // £13,999.00
    features: [
      'Up to 100 guards',
      '...+ all of Professional',
      'API access'
    ]
  },
  enterprise: {
    code: 'enterprise',
    maxGuards: 500,
    priceMonthly: 249900,      // £2,499.00
    priceAnnual: 2499900,      // £24,999.00
    features: [
      'Unlimited guards',
      '...+ all features',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee'
    ]
  }
};
```

### Overage Pricing (Hybrid Model)

If a tenant exceeds their guard limit:

```sql
-- Override plan, calculate overage
SELECT 
  s.price_monthly_cents AS base_price,
  (SELECT COUNT(*) FROM tenant_123.guards) AS current_guard_count,
  t.max_guards AS tier_limit,
  (SELECT COUNT(*) FROM tenant_123.guards) - t.max_guards AS overage_count,
  ((SELECT COUNT(*) FROM tenant_123.guards) - t.max_guards) * 3490 AS overage_cost  -- £34.90 per extra guard
FROM public.subscriptions s
JOIN public.tenants t ON s.tenant_id = t.id
WHERE t.id = 123;
```

**Implementation:** Adjust next invoice amount based on overage at billing time.

---

## REFUND POLICY

### Manual Refunds (Master Admin)

Master admin can refund via master panel:

```typescript
router.post('/api/master-admin/payments/:paymentId/refund', requireMasterAdmin, async (req, res) => {
  const { paymentId } = req.params;
  const { reason, percentage = 100 } = req.body;  // percentage = 50 for partial refund
  
  const payment = await pool.query(
    'SELECT * FROM public.payments WHERE id = $1',
    [paymentId]
  );
  
  const refundAmount = Math.floor(payment.rows[0].amount_cents * percentage / 100);
  
  // Issue refund to Stripe
  const stripeRefund = await stripe.refunds.create({
    charge: payment.rows[0].stripe_charge_id,
    amount: refundAmount,
    reason: 'requested_by_merchant',
    metadata: { reason, strondisAdminId: req.user.id }
  });
  
  // Record refund
  await pool.query(
    `UPDATE public.payments SET status = 'refunded', updated_at = $1 WHERE id = $2`,
    [Math.floor(Date.now() / 1000), paymentId]
  );
  
  // Audit log
  await logAuditEvent(req.user.id, 'payment_refunded', paymentId, { reason, percentage });
});
```

### Automatic Refund (Trial Cancellation)

If a tenant cancels during free trial:
- No refund needed (nothing was charged)
- Just mark subscription as 'cancelled'

---

## TESTING STRATEGY

### Stripe Test Mode

Use Stripe test API keys for local development:

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Test Scenarios

**Test 1: Successful charge**
```
Tenant signs up → Day 31 → Cron triggers → Invoice created → Webhook: payment_succeeded
Expected: subscription.status = 'active', payment.status = 'succeeded'
```

**Test 2: Failed charge + retry**
```
Cron creates invoice → Charge fails → Webhook: payment_failed
→ Day 34: Cron retries → Succeeds → Webhook: payment_succeeded
Expected: subscription.status = 'active' after retry, access maintained
```

**Test 3: Failed twice + access revocation**
```
Day 31: Charge fails → Day 34: Retry fails → Day 35: Cron revokes access
Expected: tenant.status = 'paused', access denied
```

**Test Cards (Stripe):**
- `4242 4242 4242 4242` — Success
- `4000 0000 0000 0002` — Failure
- `4000 0025 0000 3155` — Requires 3D Secure

---

## MONITORING & ALERTING

### Metrics to Track

1. **Daily charges:** Count of invoices created
2. **Success rate:** Succeeded / Total invoices
3. **Retry rate:** Retried charges / Failed charges
4. **Revenue:** Sum of succeeded payment amounts
5. **Churn:** Cancelled subscriptions

### Alerts to Set Up

```typescript
// Send daily digest
if (succeededPayments < expectedMinimum) {
  sendAlert('⚠️ Low payment success rate');
}

if (failedPayments > 5) {
  sendAlert('⚠️ Unusual payment failures (possible Stripe issue)');
}

if (cronJobFailed) {
  sendAlert('🚨 Billing cron job failed');
}
```

---

## ROLLBACK PLAN

### If Stripe Integration Breaks

1. **Disable globally:**
   ```bash
   railway variables set FEATURE_STRIPE=false
   ```

2. **All new signups go to free tier indefinitely** (until you fix it)

3. **Don't charge existing customers** (until you're confident)

4. **Recover:**
   - Fix the bug
   - Test thoroughly locally
   - Enable feature flag for 1 test tenant
   - Monitor for 24 hours
   - Roll out gradually to 10%, then 50%, then 100%

---

## CONCLUSION

This RFC specifies:

✅ Single Stripe account (Strondis) manages all billing  
✅ Automated charging on trial expiry  
✅ Retry logic (3 days later if initial fails)  
✅ Webhook idempotency (no duplicate charges)  
✅ Cron-based scheduling (predictable, auditable)  
✅ Master admin refunds (manual control)  
✅ Clear data model (subscriptions + payments tables)  

Implementation should follow exactly as specified in `MASTER_SPECIFICATION_v1.md` Section 5.

---

**END OF RFC #1**
