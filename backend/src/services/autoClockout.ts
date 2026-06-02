import { pool, query } from '../db/pool'

/**
 * Fix #5 — Auto clock-out service.
 * Runs every 5 minutes. Finds shifts that ended 30+ min ago with no clock-out
 * and marks them as completed with auto_clocked_out = 1.
 */
export async function processAutoClockouts(): Promise<void> {
  try {
    // Query across all tenant schemas
    const { rows: tenants } = await pool.query(
      "SELECT id FROM public.tenants WHERE status NOT IN ('deleted','archived')"
    )
    for (const tenant of tenants) {
      await processForTenant(Number(tenant.id))
    }
    // Also process public schema (seed/legacy guards)
    await processPublicSchema()
  } catch (err: any) {
    console.error('[AutoClockout] error:', err.message)
  }
}

async function processForTenant(tenantId: number): Promise<void> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { rows } = await query(`
    SELECT sh.id, sh.guard_id, sh.end_time, sh.hourly_rate, s.guard_hourly_rate, s.hourly_rate as site_rate
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    WHERE sh.end_time <= $1
      AND sh.status = 'active'
      AND sh.auto_clocked_out = 0
  `, [thirtyMinAgo], tenantId)

  for (const shift of rows) {
    const now = new Date()
    await query(`
      UPDATE shifts
      SET status = 'completed', auto_clocked_out = 1, actual_end_time = $1
      WHERE id = $2
    `, [now.toISOString(), shift.id], tenantId)

    await query("UPDATE guards SET status = 'off-duty' WHERE id = $1", [shift.guard_id], tenantId)

    // Auto-create timesheet if missing
    const { rows: existingTs } = await query(
      'SELECT id FROM timesheets WHERE guard_id = $1 AND shift_id = $2',
      [shift.guard_id, shift.id],
      tenantId
    )
    if (!existingTs[0]) {
      const { rows: ciRows } = await query(`
        SELECT created_at FROM clock_events
        WHERE shift_id = $1 AND guard_id = $2 AND type = 'clock_in'
        ORDER BY created_at DESC LIMIT 1
      `, [shift.id, shift.guard_id], tenantId)

      const clockIn  = ciRows[0] ? new Date(ciRows[0].created_at) : new Date(shift.end_time)
      const msWorked = now.getTime() - clockIn.getTime()
      const hoursWorked = Math.round((msWorked / 3600000) * 100) / 100
      const today = now.toISOString().split('T')[0]
      await query(`
        INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source, submitted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted','auto_clockout',NOW())
      `, [shift.guard_id, shift.id, today, today, Math.min(hoursWorked, 8), Math.max(0, hoursWorked - 8), hoursWorked], tenantId)
    }

    console.log(`[AutoClockout] tenant=${tenantId} shift=${shift.id} guard=${shift.guard_id} auto-clocked-out`)
  }
}

async function processPublicSchema(): Promise<void> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { rows } = await pool.query(`
    SELECT sh.id, sh.guard_id, sh.end_time
    FROM shifts sh
    WHERE sh.end_time <= $1
      AND sh.status = 'active'
      AND sh.auto_clocked_out = 0
  `, [thirtyMinAgo])

  for (const shift of rows) {
    const now = new Date()
    await pool.query(`
      UPDATE shifts SET status = 'completed', auto_clocked_out = 1, actual_end_time = $1 WHERE id = $2
    `, [now.toISOString(), shift.id])
    await pool.query("UPDATE guards SET status = 'off-duty' WHERE id = $1", [shift.guard_id])
    console.log(`[AutoClockout] public shift=${shift.id} guard=${shift.guard_id} auto-clocked-out`)
  }
}
