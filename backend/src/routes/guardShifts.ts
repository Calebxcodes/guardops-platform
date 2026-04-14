import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query, auditLog } from '../db/schema'

const router = Router()
router.use(requireAuth)

const GEOFENCE_METERS = 183 // 200 yards

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

router.get('/today', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT sh.*, s.name as site_name, s.address as site_address, s.lat, s.lng,
      s.requirements, s.post_orders, c.name as client_name, c.contact_phone as site_phone
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = $1 AND sh.start_time::date = CURRENT_DATE AND sh.status != 'cancelled'
    ORDER BY sh.start_time ASC LIMIT 1
  `, [req.guardId])
  res.json(rows[0] || null)
})

router.get('/upcoming', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT sh.*, s.name as site_name, s.address as site_address,
      c.name as client_name
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = $1 AND sh.start_time >= NOW()
      AND sh.start_time <= NOW() + INTERVAL '30 days' AND sh.status != 'cancelled'
    ORDER BY sh.start_time ASC
  `, [req.guardId])
  res.json(rows)
})

router.get('/history', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT sh.*, s.name as site_name, c.name as client_name
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = $1 AND sh.start_time < NOW()
    ORDER BY sh.start_time DESC LIMIT 30
  `, [req.guardId])
  res.json(rows)
})

router.post('/clock-in', async (req: AuthRequest, res: Response) => {
  const { shift_id, lat, lng, accuracy, photo_url, notes, face_verified } = req.body

  const { rows: shiftRows } = await query(`
    SELECT sh.*, s.lat as site_lat, s.lng as site_lng, s.name as site_name
    FROM shifts sh JOIN sites s ON s.id = sh.site_id
    WHERE sh.id = $1 AND sh.guard_id = $2
  `, [shift_id, req.guardId])
  const shift = shiftRows[0]
  if (!shift) return res.status(404).json({ error: 'Shift not found' })
  if (shift.status === 'active') return res.status(409).json({ error: 'Already clocked in' })

  // Geofence check — only enforced when the site has coordinates
  const siteLat = shift.site_lat != null ? parseFloat(shift.site_lat) : null
  const siteLng = shift.site_lng != null ? parseFloat(shift.site_lng) : null
  if (siteLat != null && siteLng != null && !isNaN(siteLat) && !isNaN(siteLng)) {
    if (lat == null || lng == null) {
      return res.status(403).json({ error: 'Location required to clock in at this site. Please enable GPS and try again.' })
    }
    const guardLat = parseFloat(lat)
    const guardLng = parseFloat(lng)
    const accuracyBuffer = Math.min(parseFloat(accuracy) || 0, 80) // account for GPS imprecision, cap 80m
    const dist = Math.round(haversineMeters(guardLat, guardLng, siteLat, siteLng))
    if (dist > GEOFENCE_METERS + accuracyBuffer) {
      const yards = Math.round(dist * 1.09361)
      return res.status(403).json({
        error: `You are ${yards} yards from ${shift.site_name}. You must be within 200 yards to clock in.`,
        distance_meters: dist,
        debug: { guard: { lat: guardLat, lng: guardLng }, site: { lat: siteLat, lng: siteLng }, accuracy_buffer: accuracyBuffer },
      })
    }
  }

  // 2FA enforcement: face verification is mandatory when guard has Face ID enrolled
  const { rows: guardRows } = await query('SELECT face_descriptor FROM guards WHERE id = $1', [req.guardId])
  const hasFaceId = !!guardRows[0]?.face_descriptor
  if (!hasFaceId) {
    return res.status(403).json({ error: 'Face ID not enrolled. Please set up Face ID in your profile before clocking in.' })
  }
  if (!face_verified) {
    return res.status(403).json({ error: 'Face ID verification required. Complete the face scan to clock in.' })
  }

  // If clocking in early, record the actual time but note the shift start for pay purposes
  const now = new Date()
  const shiftStart = new Date(shift.start_time)
  const effectiveClockIn = now < shiftStart ? shiftStart : now

  await query(`
    INSERT INTO clock_events (guard_id, shift_id, type, lat, lng, accuracy, photo_url, notes, face_verified, created_at)
    VALUES ($1,$2,'clock_in',$3,$4,$5,$6,$7,1,$8)
  `, [req.guardId, shift_id, lat, lng, accuracy, photo_url, notes, effectiveClockIn.toISOString()])

  await query("UPDATE shifts SET status = 'active' WHERE id = $1", [shift_id])
  await query("UPDATE guards SET status = 'on-duty' WHERE id = $1", [req.guardId])

  auditLog({
    user_type: 'guard', user_id: req.guardId, action: 'clock_in',
    resource_type: 'shift', resource_id: shift_id,
    extra: { lat, lng, face_verified, effective_time: effectiveClockIn.toISOString() },
    ip_address: (req as any).ip,
  })
  res.json({ success: true, clocked_in_at: effectiveClockIn.toISOString() })
})

router.post('/clock-out', async (req: AuthRequest, res: Response) => {
  const { shift_id, lat, lng, accuracy, photo_url, notes, face_verified } = req.body

  const { rows: shiftRows } = await query(`
    SELECT sh.*, s.lat as site_lat, s.lng as site_lng, s.name as site_name
    FROM shifts sh JOIN sites s ON s.id = sh.site_id
    WHERE sh.id = $1 AND sh.guard_id = $2
  `, [shift_id, req.guardId])
  if (!shiftRows[0]) return res.status(404).json({ error: 'Shift not found' })

  // Geofence check
  const shift = shiftRows[0]
  const siteLat = shift.site_lat != null ? parseFloat(shift.site_lat) : null
  const siteLng = shift.site_lng != null ? parseFloat(shift.site_lng) : null
  if (siteLat != null && siteLng != null && !isNaN(siteLat) && !isNaN(siteLng)) {
    if (lat == null || lng == null) {
      return res.status(403).json({ error: 'Location required to clock out at this site. Please enable GPS and try again.' })
    }
    const guardLat = parseFloat(lat)
    const guardLng = parseFloat(lng)
    const accuracyBuffer = Math.min(parseFloat(accuracy) || 0, 80)
    const dist = Math.round(haversineMeters(guardLat, guardLng, siteLat, siteLng))
    if (dist > GEOFENCE_METERS + accuracyBuffer) {
      const yards = Math.round(dist * 1.09361)
      return res.status(403).json({
        error: `You are ${yards} yards from ${shift.site_name}. You must be within 200 yards to clock out.`,
        distance_meters: dist,
        debug: { guard: { lat: guardLat, lng: guardLng }, site: { lat: siteLat, lng: siteLng }, accuracy_buffer: accuracyBuffer },
      })
    }
  }

  // 2FA enforcement: face verification is mandatory when guard has Face ID enrolled
  const { rows: guardRows } = await query('SELECT face_descriptor FROM guards WHERE id = $1', [req.guardId])
  const hasFaceId = !!guardRows[0]?.face_descriptor
  if (!hasFaceId) {
    return res.status(403).json({ error: 'Face ID not enrolled. Please set up Face ID in your profile before clocking out.' })
  }
  if (!face_verified) {
    return res.status(403).json({ error: 'Face ID verification required. Complete the face scan to clock out.' })
  }

  const { rows: clockInRows } = await query(`
    SELECT created_at FROM clock_events
    WHERE guard_id = $1 AND shift_id = $2 AND type = 'clock_in'
    ORDER BY created_at DESC LIMIT 1
  `, [req.guardId, shift_id])

  await query(`
    INSERT INTO clock_events (guard_id, shift_id, type, lat, lng, accuracy, photo_url, notes, face_verified)
    VALUES ($1,$2,'clock_out',$3,$4,$5,$6,$7,1)
  `, [req.guardId, shift_id, lat, lng, accuracy, photo_url, notes])

  await query("UPDATE shifts SET status = 'completed' WHERE id = $1", [shift_id])
  await query("UPDATE guards SET status = 'off-duty' WHERE id = $1", [req.guardId])

  auditLog({
    user_type: 'guard', user_id: req.guardId, action: 'clock_out',
    resource_type: 'shift', resource_id: shift_id,
    extra: { lat, lng, face_verified },
    ip_address: (req as any).ip,
  })

  let hoursWorked = 0
  if (clockInRows[0]) {
    const ms = new Date().getTime() - new Date(clockInRows[0].created_at).getTime()
    hoursWorked = Math.round((ms / 3600000) * 100) / 100
  }

  const { rows: existingTs } = await query('SELECT id FROM timesheets WHERE guard_id = $1 AND shift_id = $2', [req.guardId, shift_id])
  if (!existingTs[0]) {
    const regularHours  = Math.min(hoursWorked, 8)
    const overtimeHours = Math.max(0, hoursWorked - 8)
    const today = new Date().toISOString().split('T')[0]
    await query(`
      INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'draft','mobile')
    `, [req.guardId, shift_id, today, today, regularHours, overtimeHours, hoursWorked])
  }

  res.json({ success: true, hours_worked: hoursWorked, clocked_out_at: new Date().toISOString() })
})

router.get('/:shiftId/clock-events', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT * FROM clock_events WHERE shift_id = $1 AND guard_id = $2 ORDER BY created_at ASC
  `, [req.params.shiftId, req.guardId])
  res.json(rows)
})

// Hourly site checks
router.get('/:shiftId/checks', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT * FROM shift_checks
    WHERE shift_id = $1 AND guard_id = $2
    ORDER BY checked_at ASC
  `, [req.params.shiftId, req.guardId])
  res.json(rows)
})

router.post('/:shiftId/checks', async (req: AuthRequest, res: Response) => {
  // Verify the shift belongs to this guard
  const { rows: shiftRows } = await query(
    'SELECT id FROM shifts WHERE id = $1 AND guard_id = $2',
    [req.params.shiftId, req.guardId]
  )
  if (!shiftRows[0]) return res.status(404).json({ error: 'Shift not found' })

  const { headcount, fire_exits_clear, toilets_ok, lighting_ok, notes } = req.body
  const { rows } = await query(`
    INSERT INTO shift_checks (guard_id, shift_id, headcount, fire_exits_clear, toilets_ok, lighting_ok, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
  `, [req.guardId, req.params.shiftId,
      headcount ?? 0,
      fire_exits_clear ? 1 : 0,
      toilets_ok ? 1 : 0,
      lighting_ok ? 1 : 0,
      notes || null])
  res.status(201).json(rows[0])
})

export default router
