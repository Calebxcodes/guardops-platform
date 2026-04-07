import { query } from './schema'
import bcrypt from 'bcryptjs'

export async function seed() {
  // Clear all tables in FK-safe order
  await query(`
    DELETE FROM messages;
    DELETE FROM checkpoint_checkins;
    DELETE FROM route_checkpoints;
    DELETE FROM clock_events;
    DELETE FROM guard_auth;
    DELETE FROM incidents;
    DELETE FROM payroll_records;
    DELETE FROM timesheets;
    DELETE FROM shifts;
    DELETE FROM guards;
    DELETE FROM sites;
    DELETE FROM client_portal_tokens;
    DELETE FROM clients;
  `)

  // ── UK Clients ──────────────────────────────────────────────────────────
  const c1 = (await query(
    `INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ['Grand Events Ltd', 'Rachel Davies', 'rachel@grandevents.co.uk', '0121 400 1234', '14 Broad St, Birmingham B1 2HF', 'Weekend nightclub coverage — Fri/Sat 20:00–04:00']
  )).rows[0].id

  const c2 = (await query(
    `INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ['Prism Entertainment', 'Tom Walsh', 'tom@prismnight.co.uk', '0121 400 5678', '7 Hurst St, Birmingham B5 4TD', 'High volume venue — 3 door supervisors minimum']
  )).rows[0].id

  const c3 = (await query(
    `INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ['Bullring Management', 'Lisa Patel', 'l.patel@bullring.co.uk', '0121 600 6000', 'Bullring, Birmingham B5 4BU', 'Retail park — daytime security Mon–Sun 08:00–20:00']
  )).rows[0].id

  const c4 = (await query(
    `INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    ['NovaTech Ltd', 'Mark Spencer', 'mark.s@novatech.co.uk', '0121 200 3456', '1 Colmore Row, Birmingham B3 2BJ', 'Corporate — 1 officer on reception Mon–Fri 07:00–19:00']
  )).rows[0].id

  // ── UK Sites ────────────────────────────────────────────────────────────
  const s1 = (await query(
    `INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [c1, 'The Grand Venue', '14 Broad St, Birmingham B1 2HF', 52.4796, -1.9086, 'SIA Door Supervisor licence required', 'Monitor main entrance, ID checks, no entry to those refused by management, patrol every 30 min', 2, 16.50]
  )).rows[0].id

  const s2 = (await query(
    `INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [c2, 'Prism Nightclub', '7 Hurst St, Birmingham B5 4TD', 52.4745, -1.8994, 'SIA Door Supervisor licence required', 'Capacity 600 — enforce one-in-one-out after 23:00, no re-entry policy, radio check every hour', 3, 16.50]
  )).rows[0].id

  const s3 = (await query(
    `INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [c3, 'Bullring Retail Park', 'Bullring, Birmingham B5 4BU', 52.4774, -1.8952, 'SIA Security Guard licence required', 'Patrol retail areas, shoplifting prevention, CCTV monitoring, first aid trained preferred', 1, 14.00]
  )).rows[0].id

  const s4 = (await query(
    `INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [c4, 'NovaTech HQ — Reception', '1 Colmore Row, Birmingham B3 2BJ', 52.4838, -1.8966, 'SIA Security Guard licence, smart presentation', 'Visitor sign-in, access control, deliveries log, escalate to facilities for building issues', 1, 15.00]
  )).rows[0].id

  // ── UK Officers with SIA certs ──────────────────────────────────────────
  const insertGuard = async (
    first: string, last: string, email: string, phone: string,
    empType: string, status: string, rate: number, certs: any[], skills: any[]
  ) => (await query(
    `INSERT INTO guards (first_name, last_name, email, phone, employment_type, status, hourly_rate, certifications, skills) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [first, last, email, phone, empType, status, rate, JSON.stringify(certs), JSON.stringify(skills)]
  )).rows[0].id

  const g1 = await insertGuard('Marcus',  'Williams',  'marcus.w@strondis.com',  '07700 900142', 'full-time', 'on-duty',  14.00,
    [{name:'SIA Door Supervisor', expiry:'2025-09-15'},{name:'First Aid at Work', expiry:'2026-06-30'}],
    ['Door Supervisor','Crowd Control','First Aid'])
  const g2 = await insertGuard('Priya',   'Sharma',    'priya.s@strondis.com',   '07700 900218', 'full-time', 'on-duty',  14.00,
    [{name:'SIA Door Supervisor', expiry:'2026-03-22'},{name:'CCTV Operator', expiry:'2026-11-01'}],
    ['Door Supervisor','CCTV','Conflict Resolution'])
  const g3 = await insertGuard('Deon',    'Campbell',  'deon.c@strondis.com',    '07700 900374', 'full-time', 'off-duty', 14.00,
    [{name:'SIA Door Supervisor', expiry:'2026-07-11'}],
    ['Door Supervisor','Event Security'])
  const g4 = await insertGuard('Sarah',   'Mitchell',  'sarah.m@strondis.com',   '07700 900451', 'full-time', 'on-duty',  13.00,
    [{name:'SIA Security Guard', expiry:'2025-11-30'},{name:'First Aid at Work', expiry:'2025-09-01'}],
    ['Security Guard','Retail Security','CCTV'])
  const g5 = await insertGuard('Jason',   'Okafor',    'jason.o@strondis.com',   '07700 900583', 'part-time', 'off-duty', 13.00,
    [{name:'SIA Door Supervisor', expiry:'2026-01-05'}],
    ['Door Supervisor'])
  const g6 = await insertGuard('Amira',   'Hassan',    'amira.h@strondis.com',   '07700 900627', 'full-time', 'on-duty',  14.00,
    [{name:'SIA Door Supervisor', expiry:'2025-08-02'}],
    ['Door Supervisor','Conflict Resolution'])
  const g7 = await insertGuard('Tyler',   'Booth',     'tyler.b@strondis.com',   '07700 900714', 'on-call',   'off-duty', 13.00,
    [{name:'SIA Security Guard', expiry:'2026-05-19'}],
    ['Security Guard'])
  const g8 = await insertGuard('Fatima',  'Al-Rashid', 'fatima.a@strondis.com',  '07700 900809', 'full-time', 'on-duty',  14.00,
    [{name:'SIA Door Supervisor', expiry:'2025-12-08'},{name:'First Aid at Work', expiry:'2026-03-15'}],
    ['Door Supervisor','First Aid','Conflict Resolution'])

  // ── Shifts ──────────────────────────────────────────────────────────────
  const insertShift = (siteId: number, guardId: number | null, start: string, end: string, status: string, rate: number, notes: string) =>
    query(
      `INSERT INTO shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [siteId, guardId, start, end, status, rate, notes]
    )

  const today = new Date()
  const ds = today.toISOString().split('T')[0]
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const ds1 = tomorrow.toISOString().split('T')[0]

  // Overnight shifts: end_time is next calendar day
  await insertShift(s1, g1, `${ds}T21:00:00`,  `${ds1}T03:00:00`, 'active',    16.50, 'Friday night — main door')
  await insertShift(s1, g8, `${ds}T21:00:00`,  `${ds1}T03:00:00`, 'active',    16.50, 'Friday night — side door')
  await insertShift(s2, g2, `${ds}T20:30:00`,  `${ds1}T04:00:00`, 'active',    16.50, 'Friday night — front entrance')
  await insertShift(s2, g6, `${ds}T20:30:00`,  `${ds1}T04:00:00`, 'active',    16.50, 'Friday night — floor patrol')
  await insertShift(s3, g4, `${ds}T08:00:00`,  `${ds}T20:00:00`,  'completed', 14.00, 'Day shift — retail')
  await insertShift(s4, g7, `${ds}T07:00:00`,  `${ds}T19:00:00`,  'assigned',  15.00, 'Corporate Monday')
  await insertShift(s2, null, `${ds}T20:30:00`, `${ds1}T04:00:00`, 'unassigned', 16.50, 'URGENT: 3rd officer needed at Prism tonight')

  for (let i = 1; i <= 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const pd = d.toISOString().split('T')[0]
    const nd = new Date(d); nd.setDate(d.getDate() + 1)
    const pd1 = nd.toISOString().split('T')[0]
    await insertShift(s1, g1, `${pd}T21:00:00`, `${pd1}T03:00:00`, 'completed', 16.50, '')
    await insertShift(s2, g2, `${pd}T20:30:00`, `${pd1}T04:00:00`, 'completed', 16.50, '')
    await insertShift(s3, g4, `${pd}T08:00:00`, `${pd}T20:00:00`,  'completed', 14.00, '')
    if (i <= 7) {
      await insertShift(s1, g8, `${pd}T21:00:00`, `${pd1}T03:00:00`, 'completed', 16.50, '')
      await insertShift(s2, g6, `${pd}T20:30:00`, `${pd1}T04:00:00`, 'completed', 16.50, '')
    }
  }

  // ── Timesheets ──────────────────────────────────────────────────────────
  const insertTs = (guardId: number, ps: string, pe: string, reg: number, ot: number, total: number, status: string, source: string) =>
    query(
      `INSERT INTO timesheets (guard_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [guardId, ps, pe, reg, ot, total, status, source]
    )

  const psDate = new Date(today); psDate.setDate(today.getDate() - 14)
  const pmDate = new Date(today); pmDate.setDate(today.getDate() - 7)
  const psStr = psDate.toISOString().split('T')[0]
  const pmStr = pmDate.toISOString().split('T')[0]

  await insertTs(g1, psStr, pmStr, 40, 4, 44, 'approved', 'mobile')
  await insertTs(g2, psStr, pmStr, 40, 0, 40, 'approved', 'mobile')
  await insertTs(g4, psStr, pmStr, 38, 0, 38, 'approved', 'mobile')
  await insertTs(g8, psStr, pmStr, 40, 2, 42, 'approved', 'mobile')
  await insertTs(g1, pmStr, ds, 36, 0, 36, 'submitted', 'mobile')
  await insertTs(g2, pmStr, ds, 32, 0, 32, 'submitted', 'mobile')
  await insertTs(g4, pmStr, ds, 38, 0, 38, 'submitted', 'manual')
  await insertTs(g6, pmStr, ds, 40, 4, 44, 'draft',     'mobile')
  await insertTs(g8, pmStr, ds, 36, 0, 36, 'submitted', 'mobile')

  // ── Payroll ──────────────────────────────────────────────────────────────
  const insertPay = (guardId: number, ps: string, pe: string, regH: number, otH: number, regPay: number, otPay: number, deductions: number, gross: number, net: number, status: string, processedAt: string) =>
    query(
      `INSERT INTO payroll_records (guard_id, period_start, period_end, regular_hours, overtime_hours, regular_pay, overtime_pay, bonuses, deductions, gross_pay, net_pay, status, processed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12)`,
      [guardId, ps, pe, regH, otH, regPay, otPay, deductions, gross, net, status, processedAt]
    )

  const paid = new Date(today.getTime() - 5 * 86400000).toISOString()
  await insertPay(g1, psStr, pmStr, 40, 4,  560.00, 84.00,  64.40, 644.00, 579.60, 'paid', paid)
  await insertPay(g2, psStr, pmStr, 40, 0,  560.00,  0.00,  56.00, 560.00, 504.00, 'paid', paid)
  await insertPay(g4, psStr, pmStr, 38, 0,  494.00,  0.00,  49.40, 494.00, 444.60, 'paid', paid)
  await insertPay(g8, psStr, pmStr, 40, 2,  560.00, 42.00,  60.20, 602.00, 541.80, 'paid', paid)

  // ── Incidents ────────────────────────────────────────────────────────────
  const insertInc = (siteId: number, guardId: number, type: string, severity: string, description: string, bodycam: number, resolved: number, resolvedAt: string | null) =>
    query(
      `INSERT INTO incidents (site_id, guard_id, type, severity, description, bodycam, resolved, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [siteId, guardId, type, severity, description, bodycam, resolved, resolvedAt]
    )

  await insertInc(s2, g2, 'Altercation',       'major',
    'Two patrons refused entry at the main door following a verbal altercation. Both were removed from the queue. Police called as a precaution — reference pending. No injuries. Body cam footage secured.',
    1, 1, new Date(today.getTime() - 2 * 3600000).toISOString())
  await insertInc(s1, g1, 'Fake ID',           'minor',
    'Patron presented a suspected counterfeit driving licence at the main door. Entry refused. Patron left without further incident. Document photographed and handed to management.',
    0, 1, new Date(today.getTime() - 1 * 3600000).toISOString())
  await insertInc(s3, g4, 'Shoplifting',       'major',
    'Individual observed concealing items in clothing in store unit 14. Approached at exit. Items recovered. Store manager and police notified. CCTV footage requested from Bullring control room.',
    1, 1, new Date(today.getTime() - 5 * 3600000).toISOString())
  await insertInc(s2, g6, 'Drugs Concern',     'critical',
    'Patron appeared visibly intoxicated beyond alcohol influence. Removed from premises at 01:05. Police notified, reference number awaited. Full body-cam footage archived and available on request.',
    1, 0, null)
  await insertInc(s1, g8, 'Medical Emergency', 'major',
    'Patron reported feeling unwell at 21:38 near the main entrance. First aid applied — recovery position maintained. Ambulance called, patient transported by own means after assessment. Incident log completed.',
    0, 1, new Date(today.getTime() - 3 * 3600000).toISOString())

  // ── Auth accounts (password: guard123) ──────────────────────────────────
  const hash = await bcrypt.hash('guard123', 10)
  for (const gId of [g1, g2, g3, g4, g5, g6, g7, g8]) {
    await query(
      `INSERT INTO guard_auth (guard_id, password_hash) VALUES ($1, $2) ON CONFLICT (guard_id) DO UPDATE SET password_hash = $2`,
      [gId, hash]
    )
  }

  // ── Route checkpoints ────────────────────────────────────────────────────
  const insertCp = (siteId: number, name: string, lat: number, lng: number, order: number, instructions: string) =>
    query(
      `INSERT INTO route_checkpoints (site_id, name, lat, lng, order_num, instructions) VALUES ($1,$2,$3,$4,$5,$6)`,
      [siteId, name, lat, lng, order, instructions]
    )
  await insertCp(s1, 'Main Entrance', 52.4796, -1.9086, 1, 'Check all entry doors locked. Verify alarm status.')
  await insertCp(s1, 'Fire Exit A',   52.4797, -1.9088, 2, 'Ensure fire exit is not propped open. Check for loitering.')
  await insertCp(s1, 'Bar Area',      52.4795, -1.9082, 3, 'Observe patron behaviour. Note any concerns.')
  await insertCp(s1, 'VIP Section',   52.4794, -1.9080, 4, 'Check wristbands. No entry without correct wristband.')
  await insertCp(s1, 'Smoking Area',  52.4798, -1.9090, 5, 'No glass outside. Monitor for anti-social behaviour.')

  // ── Messages ──────────────────────────────────────────────────────────────
  await query(`INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency) VALUES (NULL, $1, $2, 0)`,
    [g1, 'Hi Marcus — your shift at The Grand Venue starts at 21:00 tonight. Report to the duty manager on arrival.'])
  await query(`INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency) VALUES (NULL, $1, $2, 0)`,
    [g2, 'Priya — reminder: capacity at Prism is 600. Strict one-in-one-out after 23:00. Radio check every hour.'])
  await query(`INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency) VALUES ($1, NULL, $2, 0)`,
    [g1, 'CCTV camera on the side exit appears to be offline. Awaiting confirmation from venue management.'])

  console.log('✅ Strondis database seeded successfully')
  console.log('   Guard login: [email] / guard123')
  console.log('   Admin login: admin@strondis.com / admin1234')
}

// Allow running directly: ts-node src/db/seed.ts
if (require.main === module) {
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
}
