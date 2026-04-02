import { getDb } from './schema'
import bcrypt from 'bcryptjs'

const db = getDb()

// Clear existing data
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

// Clients
const insertClient = db.prepare(`
  INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const c1 = insertClient.run('Nexus Shopping Mall', 'Sarah Johnson', 'sarah@nexusmall.com', '555-0101', '100 Mall Drive, Springfield, IL 62701', 'Premium client - 24/7 coverage required')
const c2 = insertClient.run('Downtown Tower Corp', 'Mike Chen', 'mike@downtowntower.com', '555-0102', '200 Business Ave, Chicago, IL 60601', 'Office hours coverage + night watchman')
const c3 = insertClient.run('Riverside Casino', 'Linda Park', 'linda@riversidecasino.com', '555-0103', '300 River Rd, Joliet, IL 60432', 'Armed guards required - high security')
const c4 = insertClient.run('Metro Hospital', 'Dr. James White', 'jwhite@metrohospital.org', '555-0104', '400 Health Blvd, Peoria, IL 61602', 'Hospital environment - patient sensitivity training needed')

// Sites
const insertSite = db.prepare(`
  INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const s1 = insertSite.run(c1.lastInsertRowid, 'Nexus Mall - Main Entrance', '100 Mall Drive, Springfield, IL', 39.7817, -89.6501, 'Unarmed, crowd control certified', 'Monitor main entrance, patrol every 2 hours, report suspicious activity', 2, 45)
const s2 = insertSite.run(c1.lastInsertRowid, 'Nexus Mall - Parking Lot', '100 Mall Drive (Parking), Springfield, IL', 39.7818, -89.6502, 'Driving license, CCTV monitoring', 'Patrol parking areas, respond to vehicle incidents', 1, 38)
const s3 = insertSite.run(c2.lastInsertRowid, 'Downtown Tower - Lobby', '200 Business Ave, Chicago, IL', 41.8781, -87.6298, 'Unarmed, professional appearance', 'Visitor sign-in, access control, rounds every hour', 1, 42)
const s4 = insertSite.run(c3.lastInsertRowid, 'Riverside Casino - Floor', '300 River Rd, Joliet, IL', 41.5250, -88.0817, 'Armed (FOID required), background check', 'Casino floor patrol, surveillance monitoring, handle disputes', 4, 65)
const s5 = insertSite.run(c4.lastInsertRowid, 'Metro Hospital - ER Entrance', '400 Health Blvd, Peoria, IL', 40.6936, -89.5890, 'De-escalation training, first aid certified', 'ER access control, handle agitated patients, coordinate with staff', 2, 48)

// Guards
const insertGuard = db.prepare(`
  INSERT INTO guards (first_name, last_name, email, phone, employment_type, status, hourly_rate, certifications, skills)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const g1 = insertGuard.run('Marcus', 'Williams', 'marcus.w@guardops.com', '555-1001', 'full-time', 'on-duty', 18,
  JSON.stringify([{name:'Security Guard License', expiry:'2025-12-31'},{name:'First Aid/CPR', expiry:'2025-06-30'}]),
  JSON.stringify(['Unarmed', 'Crowd Control', 'CCTV']))
const g2 = insertGuard.run('Priya', 'Patel', 'priya.p@guardops.com', '555-1002', 'full-time', 'on-duty', 20,
  JSON.stringify([{name:'Security Guard License', expiry:'2026-03-15'},{name:'FOID Card', expiry:'2026-01-01'},{name:'Armed Guard Permit', expiry:'2025-09-30'}]),
  JSON.stringify(['Armed', 'Unarmed', 'Surveillance']))
const g3 = insertGuard.run('Derek', 'Thompson', 'derek.t@guardops.com', '555-1003', 'full-time', 'off-duty', 17,
  JSON.stringify([{name:'Security Guard License', expiry:'2025-08-20'},{name:'De-escalation Training', expiry:'2025-11-15'}]),
  JSON.stringify(['Unarmed', 'De-escalation', 'Patient Care']))
const g4 = insertGuard.run('Aisha', 'Rahman', 'aisha.r@guardops.com', '555-1004', 'part-time', 'off-duty', 16,
  JSON.stringify([{name:'Security Guard License', expiry:'2026-02-28'}]),
  JSON.stringify(['Unarmed', 'Customer Service']))
const g5 = insertGuard.run('Carlos', 'Mendez', 'carlos.m@guardops.com', '555-1005', 'full-time', 'on-duty', 19,
  JSON.stringify([{name:'Security Guard License', expiry:'2025-10-31'},{name:'FOID Card', expiry:'2025-07-15'},{name:'Armed Guard Permit', expiry:'2025-07-15'}]),
  JSON.stringify(['Armed', 'Casino Security', 'Surveillance']))
const g6 = insertGuard.run('Tanya', 'Brooks', 'tanya.b@guardops.com', '555-1006', 'full-time', 'off-duty', 17,
  JSON.stringify([{name:'Security Guard License', expiry:'2026-01-20'},{name:'First Aid/CPR', expiry:'2026-04-10'}]),
  JSON.stringify(['Unarmed', 'Crowd Control', 'Event Security']))
const g7 = insertGuard.run('James', 'O\'Brien', 'james.o@guardops.com', '555-1007', 'on-call', 'off-duty', 15,
  JSON.stringify([{name:'Security Guard License', expiry:'2025-05-31'}]),
  JSON.stringify(['Unarmed']))
const g8 = insertGuard.run('Fatima', 'Hassan', 'fatima.h@guardops.com', '555-1008', 'full-time', 'on-duty', 18,
  JSON.stringify([{name:'Security Guard License', expiry:'2026-06-30'},{name:'De-escalation Training', expiry:'2026-03-01'}]),
  JSON.stringify(['Unarmed', 'De-escalation', 'First Aid']))

// Shifts (mix of past, present, future)
const insertShift = db.prepare(`
  INSERT INTO shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
// Today's shifts
const today = new Date()
const todayStr = today.toISOString().split('T')[0]

insertShift.run(s1.lastInsertRowid, g1.lastInsertRowid, `${todayStr}T06:00:00`, `${todayStr}T14:00:00`, 'active', 45, 'Morning shift - main entrance')
insertShift.run(s1.lastInsertRowid, g6.lastInsertRowid, `${todayStr}T14:00:00`, `${todayStr}T22:00:00`, 'assigned', 45, 'Afternoon shift - main entrance')
insertShift.run(s2.lastInsertRowid, g4.lastInsertRowid, `${todayStr}T08:00:00`, `${todayStr}T16:00:00`, 'active', 38, 'Parking lot day shift')
insertShift.run(s3.lastInsertRowid, g3.lastInsertRowid, `${todayStr}T09:00:00`, `${todayStr}T17:00:00`, 'active', 42, 'Lobby day shift')
insertShift.run(s4.lastInsertRowid, g2.lastInsertRowid, `${todayStr}T18:00:00`, `${todayStr}T02:00:00`, 'assigned', 65, 'Casino evening shift')
insertShift.run(s4.lastInsertRowid, g5.lastInsertRowid, `${todayStr}T18:00:00`, `${todayStr}T02:00:00`, 'assigned', 65, 'Casino evening shift')
insertShift.run(s5.lastInsertRowid, g8.lastInsertRowid, `${todayStr}T07:00:00`, `${todayStr}T15:00:00`, 'active', 48, 'ER morning shift')
// Uncovered shift
insertShift.run(s4.lastInsertRowid, null, `${todayStr}T06:00:00`, `${todayStr}T14:00:00`, 'unassigned', 65, 'URGENT: Casino morning shift needs cover')
insertShift.run(s5.lastInsertRowid, null, `${todayStr}T15:00:00`, `${todayStr}T23:00:00`, 'unassigned', 48, 'ER afternoon shift - needs assignment')

// Past shifts for timesheet data
for (let i = 1; i <= 14; i++) {
  const d = new Date(today)
  d.setDate(d.getDate() - i)
  const ds = d.toISOString().split('T')[0]
  insertShift.run(s1.lastInsertRowid, g1.lastInsertRowid, `${ds}T06:00:00`, `${ds}T14:00:00`, 'completed', 45, '')
  insertShift.run(s3.lastInsertRowid, g3.lastInsertRowid, `${ds}T09:00:00`, `${ds}T17:00:00`, 'completed', 42, '')
  if (i <= 7) {
    insertShift.run(s4.lastInsertRowid, g5.lastInsertRowid, `${ds}T18:00:00`, `${ds}T02:00:00`, 'completed', 65, '')
    insertShift.run(s5.lastInsertRowid, g8.lastInsertRowid, `${ds}T07:00:00`, `${ds}T15:00:00`, 'completed', 48, '')
  }
}

// Timesheets
const insertTs = db.prepare(`
  INSERT INTO timesheets (guard_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const periodStart = new Date(today); periodStart.setDate(today.getDate() - 14)
const periodMid = new Date(today); periodMid.setDate(today.getDate() - 7)
const ps = periodStart.toISOString().split('T')[0]
const pm = periodMid.toISOString().split('T')[0]

insertTs.run(g1.lastInsertRowid, ps, pm, 40, 2, 42, 'approved', 'mobile')
insertTs.run(g3.lastInsertRowid, ps, pm, 40, 0, 40, 'approved', 'mobile')
insertTs.run(g5.lastInsertRowid, ps, pm, 40, 4, 44, 'approved', 'mobile')
insertTs.run(g8.lastInsertRowid, ps, pm, 38, 0, 38, 'approved', 'mobile')
insertTs.run(g1.lastInsertRowid, pm, todayStr, 32, 0, 32, 'submitted', 'mobile')
insertTs.run(g3.lastInsertRowid, pm, todayStr, 36, 0, 36, 'submitted', 'mobile')
insertTs.run(g5.lastInsertRowid, pm, todayStr, 40, 8, 48, 'submitted', 'mobile')
insertTs.run(g8.lastInsertRowid, pm, todayStr, 38, 2, 40, 'draft', 'manual')
insertTs.run(g2.lastInsertRowid, pm, todayStr, 24, 0, 24, 'draft', 'mobile')
insertTs.run(g4.lastInsertRowid, pm, todayStr, 20, 0, 20, 'submitted', 'manual')

// Payroll records (previous period)
const insertPay = db.prepare(`
  INSERT INTO payroll_records (guard_id, period_start, period_end, regular_hours, overtime_hours, regular_pay, overtime_pay, bonuses, deductions, gross_pay, net_pay, status, processed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
insertPay.run(g1.lastInsertRowid, ps, pm, 40, 2, 720, 54, 0, 72, 774, 702, 'paid', new Date(today.getTime() - 5*86400000).toISOString())
insertPay.run(g3.lastInsertRowid, ps, pm, 40, 0, 680, 0, 0, 68, 680, 612, 'paid', new Date(today.getTime() - 5*86400000).toISOString())
insertPay.run(g5.lastInsertRowid, ps, pm, 40, 4, 760, 114, 50, 76, 924, 848, 'paid', new Date(today.getTime() - 5*86400000).toISOString())
insertPay.run(g8.lastInsertRowid, ps, pm, 38, 0, 684, 0, 0, 68, 684, 616, 'paid', new Date(today.getTime() - 5*86400000).toISOString())

// Incidents
const insertInc = db.prepare(`
  INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description, resolved)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
insertInc.run(s4.lastInsertRowid, g2.lastInsertRowid, null, 'Disturbance', 'minor', 'Patron dispute at gaming tables, resolved without escalation', 1)
insertInc.run(s1.lastInsertRowid, g1.lastInsertRowid, null, 'Theft Attempt', 'major', 'Shoplifting incident at store #12, suspect detained, police called', 1)
insertInc.run(s5.lastInsertRowid, g8.lastInsertRowid, null, 'Medical Emergency', 'critical', 'Patient became violent in waiting area, staff assisted', 1)

// Guard auth accounts (password = "guard123" for all demo accounts)
const hash = bcrypt.hashSync('guard123', 10)
const insertAuth = db.prepare('INSERT OR REPLACE INTO guard_auth (guard_id, password_hash) VALUES (?, ?)')
;[g1, g2, g3, g4, g5, g6, g7, g8].forEach(g => insertAuth.run(g.lastInsertRowid, hash))

// Route checkpoints for Nexus Mall
const insertCp = db.prepare('INSERT INTO route_checkpoints (site_id, name, lat, lng, order_num, instructions) VALUES (?, ?, ?, ?, ?, ?)')
insertCp.run(s1.lastInsertRowid, 'Main Entrance', 39.7817, -89.6501, 1, 'Check all entry doors are secured, verify alarm system active')
insertCp.run(s1.lastInsertRowid, 'Food Court', 39.7818, -89.6505, 2, 'Patrol food court area, check for loitering')
insertCp.run(s1.lastInsertRowid, 'Back Loading Dock', 39.7815, -89.6510, 3, 'Verify loading dock doors are locked, no unauthorized vehicles')
insertCp.run(s1.lastInsertRowid, 'Parking Level 2', 39.7820, -89.6498, 4, 'Drive-through or walk parking areas, check for suspicious vehicles')

// Sample messages
const insertMsg = db.prepare('INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency) VALUES (?, ?, ?, ?)')
insertMsg.run(null, g1.lastInsertRowid, 'Welcome Marcus! Your shift starts at 6 AM tomorrow at Nexus Mall Main Entrance.', 0)
insertMsg.run(null, g1.lastInsertRowid, 'Reminder: Please complete your patrol checklist every 2 hours.', 0)
insertMsg.run(g1.lastInsertRowid, 0, 'Manager, the CCTV at door 3 seems to be offline. Should I report to site maintenance?', 0)

console.log('Database seeded successfully!')
console.log(`Guards have login: [email] / password: guard123`)
console.log(`Clients: 4, Sites: 5, Guards: 8, Shifts: seeded, Timesheets: 10, Payroll: 4, Incidents: 3`)
