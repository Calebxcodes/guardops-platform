import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { pool } from '../db/pool'
import { initTenantSchema } from '../db/tenantSchema'
import { sendPasswordReset } from '../services/email'

const router = Router()

const TIER_CONFIG: Record<string, { maxGuards: number; priceCents: number }> = {
  starter:          { maxGuards: 10,  priceCents: 34900  },
  professional_30:  { maxGuards: 30,  priceCents: 49900  },
  professional_60:  { maxGuards: 60,  priceCents: 89900  },
  professional_100: { maxGuards: 100, priceCents: 139900 },
  enterprise:       { maxGuards: 500, priceCents: 249900 },
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getStripe(): InstanceType<typeof Stripe> | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

router.post('/signup', async (req: Request, res: Response) => {
  const { companyName, email, password, tier = 'starter' } = req.body

  if (!companyName || !email || !password) {
    return res.status(400).json({ error: 'companyName, email, and password are required' })
  }
  if (password.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters' })
  }
  if (!TIER_CONFIG[tier]) {
    return res.status(400).json({ error: `Invalid tier. Valid options: ${Object.keys(TIER_CONFIG).join(', ')}` })
  }

  const slug = slugify(companyName)
  if (!slug) {
    return res.status(400).json({ error: 'Company name must contain at least one alphanumeric character' })
  }

  try {
    // Check slug uniqueness
    const { rows: existing } = await pool.query(
      'SELECT id FROM public.tenants WHERE slug = $1',
      [slug]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Company name already taken. Try a variation.' })
    }

    const tierConfig = TIER_CONFIG[tier]
    const passwordHash = await bcrypt.hash(password, 10)

    // Create Stripe customer (optional — gracefully skipped if no key)
    const stripe = getStripe()
    let stripeCustomerId: string | null = null
    if (stripe) {
      const customer = await stripe.customers.create({
        email,
        name: companyName,
        metadata: { slug, tier },
      })
      stripeCustomerId = customer.id
    }

    // Insert tenant row
    const { rows: tenantRows } = await pool.query(
      `INSERT INTO public.tenants
         (slug, name, email, tier, max_guards, stripe_customer_id, status, database_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING id`,
      [slug, companyName, email, tier, tierConfig.maxGuards, stripeCustomerId, `tenant_placeholder`]
    )
    const tenantId: number = tenantRows[0].id
    const schemaName = `tenant_${tenantId}`

    // Update database_name with the real schema name
    await pool.query(
      'UPDATE public.tenants SET database_name = $1 WHERE id = $2',
      [schemaName, tenantId]
    )

    // Provision tenant schema and all tables
    await initTenantSchema(tenantId)

    // Create first admin user inside tenant schema
    await pool.query(
      `INSERT INTO ${schemaName}.admin_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [companyName, email, passwordHash]
    )

    // 30-day free trial subscription
    const trialEndsAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

    await pool.query(
      `INSERT INTO public.subscriptions
         (tenant_id, plan_code, price_monthly_cents, status, trial_ends_at)
       VALUES ($1, $2, $3, 'trialing', $4)`,
      [tenantId, tier, tierConfig.priceCents, trialEndsAt]
    )

    // Audit
    await pool.query(
      `INSERT INTO public.audit_logs
         (actor_type, action, target_type, target_id, details, ip_address)
       VALUES ('system', 'tenant_created', 'tenant', $1, $2, $3)`,
      [tenantId, JSON.stringify({ slug, email, tier }), req.ip]
    )

    const appUrl = process.env.APP_URL || 'https://strondis.com'
    res.status(201).json({
      tenantId,
      slug,
      schemaName,
      trialEndsAt,
      adminUrl: `https://${slug}.strondis.com`,
      message: `Welcome to Strondis! Your 30-day free trial starts now.`,
    })
  } catch (err: any) {
    console.error('[SignupV2]', err)
    res.status(500).json({ error: 'Signup failed. Please try again.' })
  }
})

export default router
