-- Wave 2 fixture expansion. LOCAL D1 ONLY.

-- Dave: fixed price $100, classify project as FIXED, add real tracked time.
UPDATE projects SET contract_type = 'FIXED', fixed_price_cents = 10000
WHERE name = 'Product Launch Video';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('2026-08-24 09:00:00'), unixepoch('2026-08-24 11:00:00'), 'EDITING', 'Dave cut'
FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('2026-08-25 09:00:00'), unixepoch('2026-08-25 09:30:00'), 'REVIEW', 'Dave review pass'
FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INGEST', 'admin', unixepoch('2026-08-23 09:00:00') FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'ROUGH_CUT', 'admin', unixepoch('2026-08-24 09:30:00') FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INTERNAL_QA', 'admin', unixepoch('2026-08-24 11:30:00') FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'DELIVERED', 'admin', unixepoch('2026-08-25 10:00:00') FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO qa_events (video_id, result, checklist, actor, created_at)
SELECT id, 'PASS', '{"names":true,"spelling":true,"captions":true,"audio":true,"color":true,"assets":true,"playback":true}', 'admin', unixepoch('2026-08-24 11:15:00')
FROM video_logs WHERE title = 'Product Launch Cut';
INSERT INTO deliveries (video_id, version, delivered_at, delivery_url, status, actor)
SELECT id, 1, unixepoch('2026-08-25 10:00:00'), 'https://drive.example.com/dave', 'DELIVERED', 'admin'
FROM video_logs WHERE title = 'Product Launch Cut';

-- Taryn EP1: full lifecycle to DELIVERED, clean QA, delivery on time
-- (delivered before its commitment's due date -- an ON-TIME promise-
-- accuracy sample).
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INGEST', 'admin', unixepoch('2026-08-19 09:00:00') FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'ROUGH_CUT', 'admin', unixepoch('2026-08-20 10:00:00') FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INTERNAL_QA', 'admin', unixepoch('2026-08-20 13:30:00') FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'DELIVERED', 'admin', unixepoch('2026-08-20 14:00:00') FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO qa_events (video_id, result, checklist, actor, created_at)
SELECT id, 'PASS', '{"names":true,"spelling":true,"captions":true,"audio":true,"color":true,"assets":true,"playback":true}', 'admin', unixepoch('2026-08-20 13:45:00')
FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO deliveries (video_id, commitment_id, version, delivered_at, delivery_url, status, actor)
SELECT v.id, c.id, 1, unixepoch('2026-08-20 14:00:00'), 'https://drive.example.com/ep1', 'DELIVERED', 'admin'
FROM video_logs v JOIN commitments c ON c.owner_type = 'VIDEO' AND c.owner_id = v.id AND c.description LIKE 'Deliver EP1%'
WHERE v.title = 'Mini Series EP1';

-- Taryn EP2: in client review, waiting on CLIENT.
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INGEST', 'admin', unixepoch('2026-08-26 09:00:00') FROM video_logs WHERE title = 'Mini Series EP2';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'ROUGH_CUT', 'admin', unixepoch('2026-08-27 11:00:00') FROM video_logs WHERE title = 'Mini Series EP2';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'CLIENT_REVIEW', 'admin', unixepoch('2026-08-27 12:30:00') FROM video_logs WHERE title = 'Mini Series EP2';
UPDATE video_logs SET waiting_on = 'CLIENT', next_action = 'Follow up on EP2 review' WHERE title = 'Mini Series EP2';

-- Taryn EP3: editing now, one friction event (SOFTWARE), waiting on ME.
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'INGEST', 'admin', unixepoch('2026-08-30 09:00:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'EDITING', 'admin', unixepoch('2026-08-31 09:00:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO friction_events (category, video_id, project_id, client_id, note, minutes_lost, actor, created_at)
SELECT 'SOFTWARE', v.id, v.project_id, v.client_id, 'Premiere crashed mid-export', 20, 'admin', unixepoch('2026-08-31 10:30:00')
FROM video_logs v WHERE v.title = 'Mini Series EP3';
UPDATE video_logs SET waiting_on = 'ME', next_action = 'Finish rough cut' WHERE title = 'Mini Series EP3';

-- Test Client blocked video: repeated friction (MISSING asset x4 --
-- triggers the repeated-friction detector at its default threshold of 3),
-- one QA override tied to OUR_ERROR, lifecycle REVISION (blocked).
INSERT INTO friction_events (category, video_id, note, actor, created_at)
SELECT 'FILES', id, 'Missing logo asset for opening shot', 'admin', unixepoch('2026-08-10 09:00:00') FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO friction_events (category, video_id, note, actor, created_at)
SELECT 'FILES', id, 'Missing b-roll clip 3', 'admin', unixepoch('2026-08-11 09:00:00') FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO friction_events (category, video_id, note, actor, created_at)
SELECT 'FILES', id, 'Missing music license file', 'admin', unixepoch('2026-08-12 09:00:00') FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO friction_events (category, video_id, note, actor, created_at)
SELECT 'FILES', id, 'Missing final logo export from client', 'admin', unixepoch('2026-08-13 09:00:00') FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO qa_events (video_id, result, checklist, override_reason, caused_by, actor, created_at)
SELECT id, 'OVERRIDE', '{"names":true,"spelling":false,"captions":true,"audio":true,"color":true,"assets":true,"playback":true}', 'Client needs it today, will fix spelling in v2', 'OUR_ERROR', 'admin', unixepoch('2026-08-13 15:00:00')
FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO video_lifecycle_events (video_id, stage, actor, created_at)
SELECT id, 'REVISION', 'admin', unixepoch('2026-08-14 09:00:00') FROM video_logs WHERE title = 'Edge Case Blocked Cut';
UPDATE video_logs SET waiting_on = 'CLIENT', next_action = 'Get final logo file from client' WHERE title = 'Edge Case Blocked Cut';

-- Test Client no-evidence video: a LATE delivery against its overdue
-- commitment (a real "late" promise-accuracy sample) -- delivered 3 days
-- after the commitment's due date.
INSERT INTO deliveries (video_id, commitment_id, version, delivered_at, note, status, actor)
SELECT v.id, c.id, 1, unixepoch('2026-08-25 09:00:00'), 'Late -- missing asset delay', 'DELIVERED', 'admin'
FROM video_logs v
JOIN projects p ON p.id = v.project_id
JOIN commitments c ON c.owner_type = 'PROJECT' AND c.owner_id = p.id
WHERE v.title = 'Edge Case No Evidence Cut' AND p.name = 'Edge Case Project';

-- RMedia Internal: explicitly no contract_type/fixed_price set (stays
-- excluded from any FIXED/HOURLY economics calc) -- reinforced by leaving
-- its project's contract_type NULL, which is the actual mechanism, not
-- just the client name.
