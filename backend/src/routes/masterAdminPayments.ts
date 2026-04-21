import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { pool } from '../db/pool'
import { requireMasterAdmin, requireRole } from './masterAdminAuth'

const router = Router()

function getStripe(): InstanceType<typeof Stripe> | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

// All subscriptions
router.get('/subscriptions', requireMasterAdmin, async (req: Request, res: Response) => {
  const { rows } = await pool.query(`
    SELECT
      s.id, s.tenant_id, s.plan_code, s.price_monthly_cents, s.status,
      s.trial_ends_at, s.stripe_subscription_id, s.cancelled_at,
      s.created_at, s.updated_at,
      t.name AS tenant_name, t.email AS tenant_email, t.slug
    FROM public.subscriptions s
    JOIN public.tenants t ON t.id = s.tenant_id
    ORDER BY s.created_at DESC
  `)
  res.json(rows)
})

// All payments (paginated) — defaults to most recent 100
router.get('/payments', requireMasterAdmin, async (req: Request, res: Response) => {
  const { status, tenant_id, limit = 100, offset = 0 } = req.query

  let sql = `
    SELECT
      p.id, p.tenant_id, p.stripe_invoice_id, p.stripe_charge_id,
      p.amount_cents, p.currency, p.status,
      p.attempted_at, p.succeeded_at, p.failed_at, p.next_retry_at, p.retry_count,
      p.created_at,
      t.name AS tenant_name, t.slug
    FROM public.payments p
    JOIN public.tenants t ON t.id = p.tenant_id
    WHERE 1=1
  `
  const params: any[] = []

  if (status) {
    params.push(status)
    sql += ` AND p.status = $${params.length}`
  }
  if (tenant_id) {
    params.push(Number(tenant_id))
    sql += ` AND p.tenant_id = $${params.length}`
  }

  sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(Number(limit), Number(offset))

  const { rows } = await pool.query(sql, params)
  res.json(rows)
})

// Revenue summary
router.get('/revenue', requireMasterAdmin, async (req: Request, res: Response) => {
  const { rows } = await pool.query(`
    SELECT
      SUM(CASE WHEN status = 'succeeded' THEN amount_cents ELSE 0 END)::bigint AS total_collected_cents,
      COUNT(CASE WHEN status = 'succeeded' THEN 1 END)::int                    AS successful_payments,
      COUNT(CASE WHEN status = 'failed'    THEN 1 END)::int                    AS failed_payments,
      COUNT(CASE WHEN status = 'refunded'  THEN 1 END)::int                    AS refunded_payments,
      SUM(CASE WHEN status = 'refunded' THEN amount_cents ELSE 0 END)::bigint  AS total_refunded_cents
    FROM public.payments
  `)
  res.json(rows[0])
})

// Process refund
router.post('/payments/:paymentId/refund', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { paymentId } = req.params
  const { amount_cents } = req.body

  const stripe = getStripe()
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

  const { rows } = await pool.query(
    'SELECT * FROM public.payments WHERE id = $1',
    [paymentId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' })

  const payment = rows[0]
  if (!payment.stripe_charge_id) {
    return res.status(400).json({ error: 'No Stripe charge ID on this payment' })
  }

  const refundParams: any = { charge: payment.stripe_charge_id }
  if (amount_cents) refundParams.amount = Number(amount_cents)

  const refund = await stripe.refunds.create(refundParams)

  const now = Math.floor(Date.now() / 1000)
  await pool.query(
    'UPDATE public.payments SET status = $1, updated_at = $2 WHERE id = $3',
    ['refunded', now, paymentId]
  )
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'payment_refunded', 'payment', $2, $3)`,
    [req.masterAdmin!.adminId, paymentId, JSON.stringify({ stripeRefundId: refund.id, amount_cents })]
  )

  res.json({ message: 'Refund processed', refundId: refund.id })
})

// Manually retry a failed payment
router.post('/payments/:paymentId/retry', requireMasterAdmin, requireRole('editor'), async (req: Request, res: Response) => {
  const { paymentId } = req.params
  const stripe = getStripe()
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

  const { rows } = await pool.query(
    'SELECT * FROM public.payments WHERE id = $1',
    [paymentId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found' })

  await stripe.invoices.pay(rows[0].stripe_invoice_id)

  const now = Math.floor(Date.now() / 1000)
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id)
     VALUES ('master_admin', $1, 'payment_retried', 'payment', $2)`,
    [req.masterAdmin!.adminId, paymentId]
  )

  res.json({ message: 'Payment retry triggered' })
})

export default router
