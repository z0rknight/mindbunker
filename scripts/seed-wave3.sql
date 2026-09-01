-- Wave 3 fixture expansion. LOCAL D1 ONLY.
-- Builds on top of the Wave 1 + Wave 2 fixtures already seeded for
-- Taryn / Dave / Shelley / RMedia Internal / Test Client. Nothing here
-- touches production, remote D1, or Cloudflare.

-- ============================================================
-- SENSOR DEVICE (needed once, for the Activity Overlay fixture below)
-- ============================================================
INSERT INTO sensor_devices (public_id, name, token_hash, scopes, created_at)
VALUES ('lab-fixture-device-1', 'Wave 3 Lab Fixture Sensor', 'fixture-hash-not-real', 'observations:write', unixepoch('2026-08-01 00:00:00'));

-- ============================================================
-- TARYN (client_id 1) -- dogfood flow target: Mini Series EP3
-- ============================================================

-- Missing-assets case on EP3 (checked live during the dogfood flow).
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'A_ROLL', 'READY', 'Raw footage received 8/31' FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'B_ROLL', 'MISSING', NULL FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'LOGO', 'MISSING', 'Waiting on brand team' FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'MUSIC', 'READY', NULL FROM video_logs WHERE title = 'Mini Series EP3';

-- Commitment deadline on EP3 -- open, due soon. This is the commitment the
-- dogfood flow completes via delivery below.
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, actor)
SELECT 'VIDEO', id, 'Deliver EP3 rough cut to Taryn', unixepoch('2026-09-03 18:00:00'), 'OPEN', 'admin'
FROM video_logs WHERE title = 'Mini Series EP3';

-- Work session flow on EP3, today (2026-09-01): start EDITING, switch to
-- MOTION_GRAPHICS, hit FILES friction, get blocked, resolve, resume, stop.
-- Represented as direct writes of the outcome (same disclosed technique as
-- Wave 2 -- not a mock, the actual rows the actual queries would return).
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-09-01 09:00:00'), unixepoch('2026-09-01 09:40:00'), 'EDITING', 'Rough cut pass', 'NORMAL'
FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-09-01 09:40:00'), unixepoch('2026-09-01 10:00:00'), 'MOTION_GRAPHICS', 'Lower-thirds pickup', 'NORMAL'
FROM video_logs WHERE title = 'Mini Series EP3';

INSERT INTO friction_events (category, video_id, project_id, client_id, note, minutes_lost, actor, created_at)
SELECT 'FILES', v.id, v.project_id, v.client_id, 'Missing B-roll clip referenced in script', 15, 'admin', unixepoch('2026-09-01 09:55:00')
FROM video_logs v WHERE v.title = 'Mini Series EP3';

INSERT INTO blockers (category, owner_type, owner_id, note, started_at, resolved_at, actor)
SELECT 'FILES', 'VIDEO', id, 'Cannot continue motion graphics without the B-roll asset', unixepoch('2026-09-01 10:00:00'), unixepoch('2026-09-01 10:45:00'), 'admin'
FROM video_logs WHERE title = 'Mini Series EP3';

INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-09-01 10:45:00'), unixepoch('2026-09-01 12:15:00'), 'MOTION_GRAPHICS', 'Resumed after finding alternate B-roll in library', 'NORMAL'
FROM video_logs WHERE title = 'Mini Series EP3';

-- Sensor overlay fixture: observations spanning the resumed session
-- (10:45-12:15) so Activity Overlay has real data for the last closed
-- session on EP3.
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-1', unixepoch('2026-09-01 10:45:00'), unixepoch('2026-09-01 11:00:00'), 'Premiere Pro', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-2', unixepoch('2026-09-01 11:00:00'), unixepoch('2026-09-01 11:10:00'), 'Slack', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-3', unixepoch('2026-09-01 11:10:00'), unixepoch('2026-09-01 11:35:00'), 'Premiere Pro', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-4', unixepoch('2026-09-01 11:35:00'), unixepoch('2026-09-01 11:40:00'), 'Safari', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-5', unixepoch('2026-09-01 11:40:00'), unixepoch('2026-09-01 12:05:00'), 'Premiere Pro', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';
INSERT INTO device_activity_observations (sensor_device_id, local_observation_id, started_at, ended_at, app_name, idle, source)
SELECT id, 'w3-ep3-6', unixepoch('2026-09-01 12:05:00'), unixepoch('2026-09-01 12:15:00'), 'After Effects', 0, 'MAC_SENSOR' FROM sensor_devices WHERE public_id = 'lab-fixture-device-1';

-- Lifecycle: EDITING already present from Wave 2; move to INTERNAL_QA then
-- DELIVERED.
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INTERNAL_QA', 'admin', unixepoch('2026-09-01 12:20:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'DELIVERED', 'admin', unixepoch('2026-09-01 12:40:00') FROM video_logs WHERE title = 'Mini Series EP3';

-- QA: first pass catches an OUR_ERROR issue (audio), second pass PASSes.
INSERT INTO qa_events (video_id, result, checklist, caused_by, actor, created_at)
SELECT id, 'FAIL', '{"names":true,"spelling":true,"captions":true,"audio":false,"color":true,"assets":true,"playback":true}', 'OUR_ERROR', 'admin', unixepoch('2026-09-01 12:20:00')
FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO qa_events (video_id, result, checklist, actor, created_at)
SELECT id, 'PASS', '{"names":true,"spelling":true,"captions":true,"audio":true,"color":true,"assets":true,"playback":true}', 'admin', unixepoch('2026-09-01 12:35:00')
FROM video_logs WHERE title = 'Mini Series EP3';

-- Delivery, linked to the EP3 commitment above (on time -- due 9/3, delivered 9/1).
INSERT INTO deliveries (video_id, commitment_id, version, delivered_at, delivery_url, status, actor)
SELECT v.id, c.id, 1, unixepoch('2026-09-01 12:40:00'), 'https://drive.example.com/ep3', 'DELIVERED', 'admin'
FROM video_logs v JOIN commitments c ON c.owner_type = 'VIDEO' AND c.owner_id = v.id AND c.description LIKE 'Deliver EP3%'
WHERE v.title = 'Mini Series EP3';

-- Complete the commitment (what the real deliver action does automatically).
UPDATE commitments SET status = 'DONE', completed_at = unixepoch('2026-09-01 12:40:00')
WHERE owner_type = 'VIDEO'
  AND owner_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3')
  AND description LIKE 'Deliver EP3%';

-- EP4: missing-asset + blocker fixture, left at rest (not part of the live
-- flow -- exercises the Asset Readiness + Blocker surfaces on a video that
-- stays genuinely stuck).
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'LOGO', 'MISSING', 'Client has not sent the updated logo file' FROM video_logs WHERE title = 'Mini Series EP4';
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'BRAND_GUIDE', 'MISSING', NULL FROM video_logs WHERE title = 'Mini Series EP4';
INSERT INTO blockers (category, owner_type, owner_id, note, started_at, actor)
SELECT 'CLIENT', 'VIDEO', id, 'Waiting on Taryn to send the updated logo file before EP4 can start', unixepoch('2026-08-29 10:00:00'), 'admin'
FROM video_logs WHERE title = 'Mini Series EP4';

-- Follow-up: a logged interaction on Taryn's Contact Timeline.
INSERT INTO crm_events (client_id, type, actor, description, created_at)
SELECT id, 'follow_up_sent', 'admin', 'Sent EP2 review reminder by email', unixepoch('2026-08-28 09:00:00')
FROM clients WHERE name = 'Taryn';

-- One CLIENT_CHANGE revision on EP2 (currently in client review).
INSERT INTO revisions (video_id, note, actor, caused_by, created_at)
SELECT id, 'Client requested a different music track and a shorter intro', 'client', 'CLIENT_CHANGE', unixepoch('2026-08-28 15:00:00')
FROM video_logs WHERE title = 'Mini Series EP2';

-- Daily state: yesterday (2026-08-31), so today's Wake Up / Morning Brief /
-- What-Changed-Since-Yesterday panels have a real prior day to compare
-- against.
INSERT INTO daily_states (date, sleep_hours, energy, focus, note, caffeine_count, cigarettes_count, movement, evening_note)
VALUES ('2026-08-31', 6.5, 3, 4, 'Slept late, EP3 friction stress', 2, 0, 1, 'Solid focused afternoon after resolving the B-roll blocker.');

-- ============================================================
-- DAVE (client_id 2) -- high economics coverage fixture.
-- Wave 2 seeded 2 sessions / 2.5h (MEDIUM). Adding a 3rd session pushes
-- this to 3 valid closed sessions / 3.5h / zero integrity flags -- the
-- exact HIGH threshold from the rewritten classifyDataCoverage.
-- ============================================================
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-08-26 09:00:00'), unixepoch('2026-08-26 10:00:00'), 'REVIEW', 'Final polish pass', 'NORMAL'
FROM video_logs WHERE title = 'Product Launch Cut';

-- ============================================================
-- SHELLEY (client_id 3) -- active/commercial-context edge case.
-- Already true from Wave 1/2 (contract_type NULL, no economics
-- classification possible) -- no seed change needed here, confirmed and
-- re-verified in the report rather than re-seeded.
-- ============================================================

-- ============================================================
-- TEST CLIENT (client_id 5) -- Edge Case Project.
-- Multiple friction (4x FILES, from Wave 2), a stale/open session, and a
-- late delivery already exist. Adding: missing assets, a bad (FAIL) QA
-- event, and an INVALID work session for the Repair surface.
-- ============================================================
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'A_ROLL', 'MISSING', 'Client has not delivered any footage' FROM video_logs WHERE title = 'Edge Case No Evidence Cut';
INSERT INTO asset_checklist_items (owner_type, owner_id, item_type, status, note)
SELECT 'VIDEO', id, 'TRANSCRIPT', 'MISSING', NULL FROM video_logs WHERE title = 'Edge Case No Evidence Cut';

INSERT INTO qa_events (video_id, result, checklist, actor, created_at)
SELECT id, 'FAIL', '{"names":false,"spelling":true,"captions":false,"audio":true,"color":true,"assets":false,"playback":true}', 'admin', unixepoch('2026-08-30 16:00:00')
FROM video_logs WHERE title = 'Edge Case Blocked Cut';

-- A closed session later discovered to be bogus (double-logged), marked
-- INVALID directly -- represents the outcome of an operator using
-- markSessionInvalid via the new Repair panel.
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-08-22 08:00:00'), unixepoch('2026-08-22 11:00:00'), 'EDITING', 'Double-logged -- same work already tracked in another session, marked invalid', 'INVALID'
FROM video_logs WHERE title = 'Edge Case No Evidence Cut';

-- ============================================================
-- RMEDIA INTERNAL (client_id 4) -- must remain clearly INTERNAL.
-- contract_type is already NULL from Wave 1/2 seeding (confirmed below in
-- validation) -- no seed change needed, this section is intentionally
-- empty to document that the fixture was checked, not skipped.
-- ============================================================
