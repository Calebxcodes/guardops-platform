import { getDb } from './schema'
import bcrypt from 'bcryptjs'

const db = getDb()

db.exec(`
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
  DELETE FROM clients;
`)

// ── UK Clients ──────────────────────────────────────────────────────────
const insertClient = db.prepare(`
  INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const c1 = insertClient.run('Grand Events Ltd',    'Rachel Davies', 'rachel@grandevents.co.uk',  '0121 400 1234', '14 Broad St, Birmingham B1 2HF',    'Weekend nightclub coverage — Fri/Sat 20:00–04:00')
const c2 = insertClient.run('Prism Entertainment', 'Tom Walsh',     'tom@prismnight.co.uk',      '0121 400 5678', '7 Hurst St, Birmingham B5 4TD',     'High volume venue — 3 door supervisors minimum')
const c3 = insertClient.run('Bullring Management', 'Lisa Patel',    'l.patel@bullring.co.uk',    '0121 600 6000', 'Bullring, Birmingham B5 4BU',       'Retail park — daytime security Mon–Sun 08:00–20:00')
const c4 = insertClient.run('NovaTech Ltd',        'Mark Spencer',  'mark.s@novatech.co.uk',     '0121 200 3456', '1 Colmore Row, Birmingham B3 2BJ',  'Corporate — 1 officer on reception Mon–Fri 07:00–19:00')

// ── UK Sites ────────────────────────────────────────────────────────────
const insertSite = db.prepare(`
  INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const s1 = insertSite.run(c1.lastInsertRowid, 'The Grand Venue',       '14 Broad St, Birmingham B1 2HF',    52.4796, -1.9086, 'SIA Door Supervisor licence required', 'Monitor main entrance, ID checks, no entry to those refused by management, patrol every 30 min', 2, 16.50)
const s2 = insertSite.run(c2.lastInsertRowid, 'Prism Nightclub',        '7 Hurst St, Birmingham B5 4TD',     52.4745, -1.8994, 'SIA Door Supervisor licence required', 'Capacity 600 — enforce one-in-one-out after 23:00, no re-entry policy, radio check every hour',   3, 16.50)
const s3 = insertSite.run(c3.lastInsertRowid, 'Bullring Retail Park',   'Bullring, Birmingham B5 4BU',       52.4774, -1.8952, 'SIA Security Guard licence required',  'Patrol retail areas, shoplifting prevention, CCTV monitoring, first aid trained preferred',       1, 14.00)
const s4 = insertSite.run(c4.lastInsertRowid, 'NovaTech HQ — Reception','1 Colmore Row, Birmingham B3 2BJ',  52.4838, -1.8966, 'SIA Security Guard licence, smart presentation', 'Visitor sign-in, access control, deliveries log, escalate to facilities for building issues',  1, 15.00)

// ── UK Officers with SIA certs ──────────────────────────────────────────
const insertGuard = db.prepare(`
  INSERT INTO guards (first_name, last_name, email, phone, employment_type, status, hourly_rate, certifications, skills)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const g1 = insertGuard.run('Marcus',  'Williams',   'marcus.w@secureedge.co.uk',  '07700 900142', 'full-time',  'on-duty',  14.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2025-09-15'},{name:'First Aid at Work', expiry:'2026-06-30'}]),
  JSON.stringify(['Door Supervisor','Crowd Control','First Aid']))
const g2 = insertGuard.run('Priya',   'Sharma',     'priya.s@secureedge.co.uk',   '07700 900218', 'full-time',  'on-duty',  14.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2026-03-22'},{name:'CCTV Operator',     expiry:'2026-11-01'}]),
  JSON.stringify(['Door Supervisor','CCTV','Conflict Resolution']))
const g3 = insertGuard.run('Deon',    'Campbell',   'deon.c@secureedge.co.uk',    '07700 900374', 'full-time',  'off-duty', 14.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2026-07-11'}]),
  JSON.stringify(['Door Supervisor','Event Security']))
const g4 = insertGuard.run('Sarah',   'Mitchell',   'sarah.m@secureedge.co.uk',   '07700 900451', 'full-time',  'on-duty',  13.00,
  JSON.stringify([{name:'SIA Security Guard',       expiry:'2025-11-30'},{name:'First Aid at Work', expiry:'2025-09-01'}]),
  JSON.stringify(['Security Guard','Retail Security','CCTV']))
const g5 = insertGuard.run('Jason',   'Okafor',     'jason.o@secureedge.co.uk',   '07700 900583', 'part-time',  'off-duty', 13.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2026-01-05'}]),
  JSON.stringify(['Door Supervisor']))
const g6 = insertGuard.run('Amira',   'Hassan',     'amira.h@secureedge.co.uk',   '07700 900627', 'full-time',  'on-duty',  14.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2025-08-02'}]),
  JSON.stringify(['Door Supervisor','Conflict Resolution']))
const g7 = insertGuard.run('Tyler',   'Booth',      'tyler.b@secureedge.co.uk',   '07700 900714', 'on-call',    'off-duty', 13.00,
  JSON.stringify([{name:'SIA Security Guard',       expiry:'2026-05-19'}]),
  JSON.stringify(['Security Guard']))
const g8 = insertGuard.run('Fatima',  'Al-Rashid',  'fatima.a@secureedge.co.uk',  '07700 900809', 'full-time',  'on-duty',  14.00,
  JSON.stringify([{name:'SIA Door Supervisor',      expiry:'2025-12-08'},{name:'First Aid at Work', expiry:'2026-03-15'}]),
  JSON.stringify(['Door Supervisor','First Aid','Conflict Resolution']))

// ── Shifts ──────────────────────────────────────────────────────────────
const insertShift = db.prepare(`
  INSERT INTO shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const today = new Date()
const ds    = today.toISOString().split('T')[0]

// Tonight's active shifts
insertShift.run(s1.lastInsertRowid, g1.lastInsertRowid, `${ds}T21:00:00`, `${ds}T03:00:00`, 'active',   16.50, 'Friday night — main door')
insertShift.run(s1.lastInsertRowid, g8.lastInsertRowid, `${ds}T21:00:00`, `${ds}T03:00:00`, 'active',   16.50, 'Friday night — side door')
insertShift.run(s2.lastInsertRowid, g2.lastInsertRowid, `${ds}T20:30:00`, `${ds}T04:00:00`, 'active',   16.50, 'Friday night — front entrance')
insertShift.run(s2.lastInsertRowid, g6.lastInsertRowid, `${ds}T20:30:00`, `${ds}T04:00:00`, 'active',   16.50, 'Friday night — floor patrol')
insertShift.run(s3.lastInsertRowid, g4.lastInsertRowid, `${ds}T08:00:00`, `${ds}T20:00:00`, 'completed',14.00, 'Day shift — retail')
insertShift.run(s4.lastInsertRowid, g7.lastInsertRowid, `${ds}T07:00:00`, `${ds}T19:00:00`, 'assigned', 15.00, 'Corporate Monday')
// Understaffed — Prism needs 3 but only 2 assigned
// Uncovered — NovaTech tomorrow
insertShift.run(s2.lastInsertRowid, null, `${ds}T20:30:00`, `${ds}T04:00:00`, 'unassigned', 16.50, 'URGENT: 3rd officer needed at Prism tonight')

// Past 14 days for charts
for (let i = 1; i <= 14; i++) {
  const d  = new Date(today); d.setDate(d.getDate() - i)
  const pd = d.toISOString().split('T')[0]
  insertShift.run(s1.lastInsertRowid, g1.lastInsertRowid, `${pd}T21:00:00`, `${pd}T03:00:00`, 'completed', 16.50, '')
  insertShift.run(s2.lastInsertRowid, g2.lastInsertRowid, `${pd}T20:30:00`, `${pd}T04:00:00`, 'completed', 16.50, '')
  insertShift.run(s3.lastInsertRowid, g4.lastInsertRowid, `${pd}T08:00:00`, `${pd}T20:00:00`, 'completed', 14.00, '')
  if (i <= 7) {
    insertShift.run(s1.lastInsertRowid, g8.lastInsertRowid, `${pd}T21:00:00`, `${pd}T03:00:00`, 'completed', 16.50, '')
    insertShift.run(s2.lastInsertRowid, g6.lastInsertRowid, `${pd}T20:30:00`, `${pd}T04:00:00`, 'completed', 16.50, '')
  }
}

// ── Timesheets ───────────────────────────────────────────────────────────
const insertTs = db.prepare(`
  INSERT INTO timesheets (guard_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const ps = new Date(today); ps.setDate(today.getDate() - 14)
const pm = new Date(today); pm.setDate(today.getDate() - 7)
const psStr = ps.toISOString().split('T')[0]
const pmStr = pm.toISOString().split('T')[0]

insertTs.run(g1.lastInsertRowid, psStr, pmStr, 40, 4, 44, 'approved', 'mobile')
insertTs.run(g2.lastInsertRowid, psStr, pmStr, 40, 0, 40, 'approved', 'mobile')
insertTs.run(g4.lastInsertRowid, psStr, pmStr, 38, 0, 38, 'approved', 'mobile')
insertTs.run(g8.lastInsertRowid, psStr, pmStr, 40, 2, 42, 'approved', 'mobile')
insertTs.run(g1.lastInsertRowid, pmStr, ds,    36, 0, 36, 'submitted','mobile')
insertTs.run(g2.lastInsertRowid, pmStr, ds,    32, 0, 32, 'submitted','mobile')
insertTs.run(g4.lastInsertRowid, pmStr, ds,    38, 0, 38, 'submitted','manual')
insertTs.run(g6.lastInsertRowid, pmStr, ds,    40, 4, 44, 'draft',    'mobile')
insertTs.run(g8.lastInsertRowid, pmStr, ds,    36, 0, 36, 'submitted','mobile')

// ── Payroll ──────────────────────────────────────────────────────────────
const insertPay = db.prepare(`
  INSERT INTO payroll_records (guard_id, period_start, period_end, regular_hours, overtime_hours,
    regular_pay, overtime_pay, bonuses, deductions, gross_pay, net_pay, status, processed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const paid = new Date(today.getTime() - 5 * 86400000).toISOString()
insertPay.run(g1.lastInsertRowid, psStr, pmStr, 40, 4,  560.00,  84.00, 0,  64.40,  644.00,  579.60, 'paid', paid)
insertPay.run(g2.lastInsertRowid, psStr, pmStr, 40, 0,  560.00,   0.00, 0,  56.00,  560.00,  504.00, 'paid', paid)
insertPay.run(g4.lastInsertRowid, psStr, pmStr, 38, 0,  494.00,   0.00, 0,  49.40,  494.00,  444.60, 'paid', paid)
insertPay.run(g8.lastInsertRowid, psStr, pmStr, 40, 2,  560.00,  42.00, 0,  60.20,  602.00,  541.80, 'paid', paid)

// ── Incidents ────────────────────────────────────────────────────────────
const insertInc = db.prepare(`
  INSERT INTO incidents (site_id, guard_id, type, severity, description, bodycam, resolved, resolved_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
insertInc.run(s2.lastInsertRowid, g2.lastInsertRowid, 'Altercation',       'major',
  'Two patrons refused entry at the main door following a verbal altercation. Both were removed from the queue. Police called as a precaution — reference pending. No injuries. Body cam footage secured.',
  1, 1, new Date(today.getTime() - 2 * 3600000).toISOString())
insertInc.run(s1.lastInsertRowid, g1.lastInsertRowid, 'Fake ID',           'minor',
  'Patron presented a suspected counterfeit driving licence at the main door. Entry refused. Patron left without further incident. Document photographed and handed to management.',
  0, 1, new Date(today.getTime() - 1 * 3600000).toISOString())
insertInc.run(s3.lastInsertRowid, g4.lastInsertRowid, 'Shoplifting',       'major',
  'Individual observed concealing items in clothing in store unit 14. Approached at exit. Items recovered. Store manager and police notified. CCTV footage requested from Bullring control room.',
  1, 1, new Date(today.getTime() - 5 * 3600000).toISOString())
insertInc.run(s2.lastInsertRowid, g6.lastInsertRowid, 'Drugs Concern',     'critical',
  'Patron appeared visibly intoxicated beyond alcohol influence. Removed from premises at 01:05. Police notified, reference number awaited. Full body-cam footage archived and available on request.',
  1, 0, null)
insertInc.run(s1.lastInsertRowid, g8.lastInsertRowid, 'Medical Emergency', 'major',
  'Patron reported feeling unwell at 21:38 near the main entrance. First aid applied — recovery position maintained. Ambulance called, patient transported by own means after assessment. Incident log completed.',
  0, 1, new Date(today.getTime() - 3 * 3600000).toISOString())

// ── Auth accounts (password: guard123) ──────────────────────────────────
const hash      = bcrypt.hashSync('guard123', 10)
const insertAuth = db.prepare('INSERT OR REPLACE INTO guard_auth (guard_id, password_hash) VALUES (?, ?)')
;[g1,g2,g3,g4,g5,g6,g7,g8].forEach(g => insertAuth.run(g.lastInsertRowid, hash))

// ── Route checkpoints — The Grand Venue ────────────────────────────────
const insertCp = db.prepare('INSERT INTO route_checkpoints (site_id, name, lat, lng, order_num, instructions) VALUES (?, ?, ?, ?, ?, ?)')
insertCp.run(s1.lastInsertRowid, 'Main Entrance',   52.4796, -1.9086, 1, 'Check all entry doors locked. Verify alarm status.')
insertCp.run(s1.lastInsertRowid, 'Fire Exit A',     52.4797, -1.9088, 2, 'Ensure fire exit is not propped open. Check for loitering.')
insertCp.run(s1.lastInsertRowid, 'Bar Area',        52.4795, -1.9082, 3, 'Observe patron behaviour. Note any concerns.')
insertCp.run(s1.lastInsertRowid, 'VIP Section',     52.4794, -1.9080, 4, 'Check wristbands. No entry without correct wristband.')
insertCp.run(s1.lastInsertRowid, 'Smoking Area',    52.4798, -1.9090, 5, 'No glass outside. Monitor for anti-social behaviour.')

// ── Messages ─────────────────────────────────────────────────────────────
const insertMsg = db.prepare('INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency) VALUES (?, ?, ?, ?)')
insertMsg.run(null, g1.lastInsertRowid, 'Hi Marcus — your shift at The Grand Venue starts at 21:00 tonight. Report to the duty manager on arrival.', 0)
insertMsg.run(null, g2.lastInsertRowid, 'Priya — reminder: capacity at Prism is 600. Strict one-in-one-out after 23:00. Radio check every hour.', 0)
insertMsg.run(g1.lastInsertRowid, null, 'CCTV camera on the side exit appears to be offline. Awaiting confirmation from venue management.', 0)

console.log('✅ SecureEdge database seeded successfully')
console.log('   Guard login: [email] / guard123')
console.log('   Admin login: admin@secureedge.co.uk / admin123')
