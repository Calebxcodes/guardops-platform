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

// Retry failed payments that are due for their 3-day retry
export async function runRenewalCron(): Promise<void> {
  const stripe = getStripe()
  if (!stripe) {
    console.log('[RenewalCron] No Stripe key — skipping')
    return
  }

  const now = Math.floor(Date.now() / 1000)

  const { rows } = await pool.query(`
    SELECT
      p.id              AS payment_id,
      p.tenant_id,
      p.stripe_invoice_id,
      p.retry_count,
      t.stripe_customer_id,
      s.id              AS sub_id
    FROM public.payments p
    JOIN public.tenants t ON t.id = p.tenant_id
    JOIN public.subscriptions s ON s.tenant_id = p.tenant_id
    WHERE p.status = 'failed'
      AND p.next_retry_at IS NOT NULL
      AND p.next_retry_at <= $1
      AND t.stripe_customer_id IS NOT NULL
  `, [now])

  for (const row of rows) {
    try {
      const invoice = await stripe.invoices.retrieve(row.stripe_invoice_id)

      if (invoice.status === 'paid') {
        // Already paid via webhook — just clean up
        await pool.query(
          `UPDATE public.payments SET status = 'succeeded', succeeded_at = $1, updated_at = $1 WHERE id = $2`,
          [now, row.payment_id]
        )
        await pool.query(
          `UPDATE public.subscriptions SET status = 'active', updated_at = $1 WHERE id = $2`,
          [now, row.sub_id]
        )
        continue
      }

      await stripe.invoices.pay(row.stripe_invoice_id)
      console.log(`[RenewalCron] Retried payment for tenant ${row.tenant_id}`)
    } catch (err: any) {
      console.error(`[RenewalCron] Retry failed for tenant ${row.tenant_id}:`, err.message)

      if (row.retry_count >= 1) {
        // Second failure — pause the tenant
        await pool.query(
          `UPDATE public.payments SET status = 'failed', next_retry_at = NULL, updated_at = $1 WHERE id = $2`,
          [now, row.payment_id]
        )
        await pool.query(
          `UPDATE public.subscriptions SET status = 'cancelled', updated_at = $1 WHERE id = $2`,
          [now, row.sub_id]
        )
        await pool.query(
          `UPDATE public.tenants SET status = 'paused', updated_at = $1 WHERE id = $2`,
          [now, row.tenant_id]
        )

        const email = await getTenantEmail(row.tenant_id)
        if (email) {
          await sendAlertEmail(email, 'Account paused — Strondis', [
            'We were unable to process your payment after two attempts.',
            'Your account has been paused. Contact support to reactivate.',
          ])
        }
      } else {
        // Schedule one more retry in 3 days
        const nextRetry = now + 3 * 24 * 60 * 60
        await pool.query(
          `UPDATE public.payments
           SET retry_count = retry_count + 1, next_retry_at = $1, updated_at = $2
           WHERE id = $3`,
          [nextRetry, now, row.payment_id]
        )
      }
    }
  }

  if (rows.length > 0) console.log(`[RenewalCron] Processed ${rows.length} payment retries`)
}
