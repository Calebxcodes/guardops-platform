# Resets the "Strondis Demo" tenant (slug strondis-demo, schema tenant_17) to a known story:
#   1 client, 1 site with a guard rate, 2 activated guards with valid SIA badges,
#   3 past shifts with approved timesheets, 1 upcoming shift (tomorrow).
# The site has no map location, so clock-in works anywhere (set one in Sites to demo geofencing on-site).
# Reset does not change the admin password; if a demo used "forgot password", the new one stays.
# Logins after reset:
#   admin  https://strondis-demo.strondis.com   okekecaleb69+demo-owner@gmail.com   (password unchanged by reset)
#   guards https://guard.strondis.com           okekecaleb69+demo-guard1@gmail.com / okekecaleb69+demo-guard2@gmail.com   (password: see DEMO_READY_2026-11-06.md)
#
# SAFETY: this script can only touch tenant_17. The schema is a constant here (no parameter), every statement
# is qualified with it, and the transaction aborts unless public.tenants says tenant_17 is the strondis-demo
# tenant owned by the demo address. Nothing outside tenant_17 is written except that tenant's own guard_links rows.
#
# Usage: powershell -File scripts\reset-demo.ps1        (needs `railway login`)

$ErrorActionPreference = 'Stop'
$Schema = 'tenant_17'
$TenantId = 17

$sql = @"
\set ON_ERROR_STOP on
BEGIN;
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = $TenantId AND slug = 'strondis-demo' AND database_name = '$Schema'
                 AND email = 'okekecaleb69+demo-owner@gmail.com' AND name = 'Strondis Demo')
  THEN RAISE EXCEPTION 'REFUSED: $Schema is not the strondis-demo tenant'; END IF;
  IF (SELECT count(*) FROM public.tenants WHERE slug = 'strondis-demo' OR database_name = '$Schema') <> 1
  THEN RAISE EXCEPTION 'REFUSED: ambiguous demo tenant'; END IF;
END `$`$;

-- wipe demo data (admin owner, roles and time-off types are kept)
TRUNCATE $Schema.audit_log, $Schema.checklist_templates, $Schema.checkpoint_checkins, $Schema.client_portal_tokens,
  $Schema.clock_events, $Schema.documents, $Schema.incidents, $Schema.messages, $Schema.password_reset_tokens,
  $Schema.payroll_records, $Schema.push_subscriptions, $Schema.route_checkpoints, $Schema.security_badges,
  $Schema.shift_check_items, $Schema.shift_checks, $Schema.tax_documents, $Schema.time_off_requests,
  $Schema.timesheets, $Schema.shifts, $Schema.guard_auth, $Schema.guards, $Schema.sites, $Schema.clients
  RESTART IDENTITY CASCADE;
DELETE FROM $Schema.admin_users WHERE email <> 'okekecaleb69+demo-owner@gmail.com';
DELETE FROM public.guard_links WHERE tenant_id = $TenantId;

-- seed
INSERT INTO $Schema.clients (name, contact_name, contact_email, contact_phone, address, hourly_rate)
VALUES ('Canary Wharf Estates Ltd', 'Priya Shah', 'okekecaleb69+demo-client@gmail.com', '020 7946 0000', '1 Canada Square, London E14 5AB', 24);

INSERT INTO $Schema.sites (client_id, name, address, lat, lng, guards_required, hourly_rate, guard_hourly_rate, post_orders)
VALUES (1, 'One Canada Square', '1 Canada Square, London E14 5AB', NULL, NULL, 1, 24, 13.50, -- no coordinates: geofence off so the demo guard can clock in from anywhere
        'Front desk and lobby patrol. Hourly perimeter check. Report incidents in the app.');

INSERT INTO $Schema.guards (first_name, last_name, email, phone, status, active, employment_type, certifications)
VALUES ('Amelia', 'Hart',   'okekecaleb69+demo-guard1@gmail.com', '07700 900101', 'off-duty', 1, 'full-time', '[{"name":"SIA Licence","licence_number":"1012345678901234","expiry":"2028-06-30"}]'),
       ('Daniel', 'Okafor', 'okekecaleb69+demo-guard2@gmail.com', '07700 900102', 'off-duty', 1, 'part-time', '[{"name":"SIA Licence","licence_number":"1098765432109876","expiry":"2027-11-30"}]');

INSERT INTO $Schema.guard_auth (guard_id, password_hash) VALUES
  (1, '`$2a`$10`$7joN5Xpwr63Bw7cV093KBOs.PZTgfRXIdpgXnmYOya.7LbdHTcJAu'),
  (2, '`$2a`$10`$7joN5Xpwr63Bw7cV093KBOs.PZTgfRXIdpgXnmYOya.7LbdHTcJAu');
INSERT INTO public.guard_links (guard_email, tenant_id, guard_id) VALUES
  ('okekecaleb69+demo-guard1@gmail.com', $TenantId, 1), ('okekecaleb69+demo-guard2@gmail.com', $TenantId, 2);

INSERT INTO $Schema.security_badges (guard_id, sia_license_number, sia_expiry_date, card_type, is_current, status)
VALUES (1, '1012345678901234', '2028-06-30', 'Door Supervisor', 1, 'verified'),
       (2, '1098765432109876', '2027-11-30', 'Security Guard', 1, 'verified');

-- 3 past day shifts (08:00-16:00 UK time), completed, with approved 8h timesheets
INSERT INTO $Schema.shifts (site_id, guard_id, start_time, end_time, actual_end_time, status, hourly_rate, break_minutes)
SELECT 1, g, s, s + interval '8 hours', s + interval '8 hours', 'completed', 24, 30
FROM (VALUES (1, 4), (2, 3), (1, 2)) v(g, d),
     LATERAL (SELECT ((current_date - d) + time '08:00') AT TIME ZONE 'Europe/London' AS s) t;

INSERT INTO $Schema.timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source, submitted_at, approved_at)
SELECT guard_id, id, to_char(start_time AT TIME ZONE 'Europe/London', 'YYYY-MM-DD'), to_char(start_time AT TIME ZONE 'Europe/London', 'YYYY-MM-DD'),
       8, 0, 8, 'approved', 'clock', end_time, end_time + interval '1 hour'
FROM $Schema.shifts ORDER BY id;

-- 1 upcoming shift tomorrow
INSERT INTO $Schema.shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes)
VALUES (1, 1, ((current_date + 1) + time '08:00') AT TIME ZONE 'Europe/London', ((current_date + 1) + time '16:00') AT TIME ZONE 'Europe/London', 'assigned', 24, 30);

COMMIT;
SELECT 'SEEDED', (SELECT count(*) FROM $Schema.clients) clients, (SELECT count(*) FROM $Schema.sites) sites,
  (SELECT count(*) FROM $Schema.guards) guards, (SELECT count(*) FROM $Schema.shifts) shifts,
  (SELECT count(*) FROM $Schema.timesheets WHERE status = 'approved') approved_timesheets,
  (SELECT count(*) FROM $Schema.admin_users) admins;
"@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($sql -replace "`r", '')))
$out = [IO.Path]::GetTempFileName()
$job = Start-Job {
  cmd /c "railway ssh -p 3622ca0b-0e61-499d-93c6-a9009824fb42 -e production -s f9a0ea95-b943-435a-9b91-f2794a03b817 -- sh -c `"echo warmup; echo $using:b64 | base64 -d > /tmp/reset_demo.sql; psql -U postgres -d railway -At -F '|' -P pager=off -f /tmp/reset_demo.sql; rm -f /tmp/reset_demo.sql; echo __END__`" > `"$using:out`" 2>&1"
}
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline -and $job.State -eq 'Running') {
  if ((Get-Content $out -Raw -ErrorAction SilentlyContinue) -match '__END__') { break }
  Start-Sleep -Milliseconds 500
}
Stop-Job $job; Remove-Job $job -Force
$text = ([IO.File]::ReadAllText($out)) -replace "`r", '' -replace '\x1b\[[0-9;?]*[a-zA-Z=>]', '' -replace '\x1b[=>]', ''
Remove-Item $out
$text = $text -replace '(?s)__END__.*', ''
Write-Output $text
if ($text -notmatch 'SEEDED') { Write-Error 'Demo reset did not complete (see output above).' }
