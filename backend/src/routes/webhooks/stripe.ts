import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { pool } from '../../db/pool'
import { sendAlertEmail } from '../../services/email'

const router = Router()

function getStripe(): InstanceType<typeof Stripe> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key)
}

async function getTenantEmail(tenantId: number): Promise<string> {
  const { rows } = await pool.query('SELECT email FROM public.tenants WHERE id = $1', [tenantId])
  return rows[0]?.email ?? ''
}

router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  let event: any
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'] as string,
      webhookSecret
    )
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook error: ${err.message}`)
  }

  try {
    const now = Math.floor(Date.now() / 1000)

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

        const { rows } = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [customerId]
        )
        if (!rows[0]) break
        const tenantId: number = rows[0].id

        // Idempotency check
        const { rows: existing } = await pool.query(
          "SELECT id FROM public.payments WHERE stripe_invoice_id = $1 AND status = 'succeeded'",
          [invoice.id]
        )
        if (existing.length > 0) break // already processed

        await pool.query(
          `UPDATE public.payments
           SET status = 'succeeded', succeeded_at = $1, updated_at = $2
           WHERE stripe_invoice_id = $3`,
          [now, now, invoice.id]
        )

        // If no payment row exists (rare), insert one
        await pool.query(
          `INSERT INTO public.payments
             (tenant_id, stripe_invoice_id, stripe_charge_id, amount_cents, currency, status, attempted_at, succeeded_at)
           VALUES ($1, $2, $3, $4, 'GBP', 'succeeded', $5, $5)
           ON CONFLICT (stripe_invoice_id) DO NOTHING`,
          [tenantId, invoice.id, invoice.charge, invoice.total, now]
        )

        await pool.query(
          "UPDATE public.subscriptions SET status = 'active', updated_at = $1 WHERE tenant_id = $2",
          [now, tenantId]
        )

        const email = await getTenantEmail(tenantId)
        if (email) {
          await sendAlertEmail(email, 'Payment received — Strondis', [
            `Payment of £${((invoice.total ?? 0) / 100).toFixed(2)} received. Thank you!`,
            `Invoice: ${invoice.id}`,
          ])
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

        const { rows } = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [customerId]
        )
        if (!rows[0]) break
        const tenantId: number = rows[0].id

        const retryAt = now + 3 * 24 * 60 * 60 // 3 days

        await pool.query(
          `INSERT INTO public.payments
             (tenant_id, stripe_invoice_id, amount_cents, currency, status, attempted_at, failed_at, next_retry_at)
           VALUES ($1, $2, $3, 'GBP', 'failed', $4, $4, $5)
           ON CONFLICT (stripe_invoice_id) DO UPDATE
             SET status = 'failed', failed_at = $4, next_retry_at = $5,
                 retry_count = public.payments.retry_count + 1, updated_at = $4`,
          [tenantId, invoice.id, invoice.total ?? 0, now, retryAt]
        )

        await pool.query(
          "UPDATE public.subscriptions SET status = 'past_due', updated_at = $1 WHERE tenant_id = $2",
          [now, tenantId]
        )

        const email = await getTenantEmail(tenantId)
        if (email) {
          await sendAlertEmail(email, 'Payment failed — Strondis', [
            'Your payment failed. We will retry in 3 days.',
            'Please update your payment method to avoid losing access.',
          ])
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

        const { rows } = await pool.query(
          'SELECT id FROM public.tenants WHERE stripe_customer_id = $1',
          [customerId]
        )
        if (!rows[0]) break
        const tenantId: number = rows[0].id

        await pool.query(
          `UPDATE public.subscriptions
           SET status = 'cancelled', cancelled_at = $1, updated_at = $1
           WHERE tenant_id = $2`,
          [now, tenantId]
        )

        await pool.query(
          "UPDATE public.tenants SET status = 'paused', updated_at = $1 WHERE id = $2",
          [now, tenantId]
        )

        await pool.query(
          `INSERT INTO public.audit_logs
             (actor_type, action, target_type, target_id, details)
           VALUES ('system', 'subscription_cancelled', 'tenant', $1, $2)`,
          [tenantId, JSON.stringify({ stripe_sub: sub.id })]
        )
        break
      }

      default:
        // Ignored event types
        break
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error('[Stripe Webhook] Handler error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
