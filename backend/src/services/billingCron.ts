import Stripe from 'stripe'
import { pool } from '../db/pool'
import { sendAlertEmail } from './email'

function getStripe(): InstanceType<typeof Stripe> | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

async function getTenantEmail(tenantId: number): Promise<string> {
  const { rows } = await pool.query('SELECT email FROM public.tenants WHERE id = $1', [tenantId])
  return rows[0]?.email ?? ''
}

// Charge tenants whose trial has ended but no active subscription exists yet
export async function runBillingCron(): Promise<void> {
  const stripe = getStripe()
  if (!stripe) {
    console.log('[BillingCron] No Stripe key — skipping')
    return
  }

  const now = Math.floor(Date.now() / 1000)

  const { rows } = await pool.query(`
    SELECT
      t.id          AS tenant_id,
      t.email,
      t.stripe_customer_id,
      s.id          AS sub_id,
      s.plan_code,
      s.price_monthly_cents,
      s.trial_ends_at
    FROM public.subscriptions s
    JOIN public.tenants t ON t.id = s.tenant_id
    WHERE s.status = 'trialing'
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at < $1
      AND t.stripe_customer_id IS NOT NULL
  `, [now])

  for (const row of rows) {
    try {
      const priceId = process.env[`STRIPE_PRICE_${row.plan_code.toUpperCase()}`]
      if (!priceId) {
        console.error(`[BillingCron] No price ID env var for plan ${row.plan_code}`)
        continue
      }

      const stripeSub = await stripe.subscriptions.create({
        customer: row.stripe_customer_id,
        items: [{ price: priceId }],
        metadata: { tenant_id: String(row.tenant_id) },
      })

      await pool.query(
        `UPDATE public.subscriptions
         SET status = 'active', stripe_subscription_id = $1, updated_at = $2
         WHERE id = $3`,
        [stripeSub.id, now, row.sub_id]
      )

      console.log(`[BillingCron] Converted tenant ${row.tenant_id} to paid`)
    } catch (err: any) {
      console.error(`[BillingCron] Failed to charge tenant ${row.tenant_id}:`, err.message)

      await pool.query(
        `UPDATE public.subscriptions SET status = 'past_due', updated_at = $1 WHERE id = $2`,
        [now, row.sub_id]
      )

      const email = await getTenantEmail(row.tenant_id)
      if (email) {
        await sendAlertEmail(email, 'Your free trial has ended — Strondis', [
          'Your 30-day free trial has ended and we were unable to charge your payment method.',
          'Please update your billing details to continue using Strondis.',
        ])
      }
    }
  }

  if (rows.length > 0) console.log(`[BillingCron] Processed ${rows.length} trial-to-paid conversions`)
}
