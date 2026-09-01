-- September Local Feature Harvest -- disposable local-only fixture data.
-- LOCAL D1 ONLY. Never run against --remote.

INSERT INTO clients (name, status, email, notes, next_action, next_action_date, opportunity_stage)
VALUES
  ('Taryn', 'active', 'taryn@example.com', 'Local Lab fixture -- active hourly client, mini series in flight.', 'Waiting on EP2 review', '2026-09-05', 'active'),
  ('Dave', 'active', 'dave@example.com', 'Local Lab fixture -- fixed-price $100, one delivered video.', NULL, NULL, 'active'),
  ('Shelley', 'active', 'shelley@example.com', 'Local Lab fixture -- active, no canonical contract on file.', NULL, NULL, 'active'),
  ('RMedia Internal', 'active', NULL, 'Local Lab fixture -- INTERNAL work only. Must never be counted in customer economics/revenue stats.', NULL, NULL, 'active'),
  ('Test Client', 'active', 'test@example.com', 'Local Lab fixture -- disposable edge cases (overdue commitments, stale session, multiple revisions, blocked project). Safe to delete entirely.', NULL, NULL, 'active');

INSERT INTO projects (client_id, name, status, deadline, notes)
SELECT id, 'Mini Series', 'in_progress', '2026-09-15', 'EP1-EP4 mini series' FROM clients WHERE name = 'Taryn';
INSERT INTO projects (client_id, name, status, deadline, notes)
SELECT id, 'Product Launch Video', 'in_progress', NULL, 'Fixed $100 delivery' FROM clients WHERE name = 'Dave';
INSERT INTO projects (client_id, name, status, deadline, notes)
SELECT id, 'Brand Reel', 'in_progress', NULL, 'No contract on file yet' FROM clients WHERE name = 'Shelley';
INSERT INTO projects (client_id, name, status, deadline, notes)
SELECT id, 'Internal Showreel', 'in_progress', NULL, 'Internal only -- excluded from customer economics' FROM clients WHERE name = 'RMedia Internal';
INSERT INTO projects (client_id, name, status, deadline, notes)
SELECT id, 'Edge Case Project', 'in_progress', '2026-08-20', 'Deliberately blocked -- disposable' FROM clients WHERE name = 'Test Client';

-- Taryn mini series: EP1 delivered, EP2 in review (with one client-change
-- revision = friction), EP3 editing, EP4 planned.
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, delivery_url, review_url, revisions_count)
SELECT '2026-08-20', 'Mini Series EP1', c.id, p.id, 'DONE', 1, 'https://drive.example.com/ep1', NULL, 0
FROM clients c JOIN projects p ON p.client_id = c.id AND p.name = 'Mini Series' WHERE c.name = 'Taryn';
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, review_url, revisions_count)
SELECT '2026-08-27', 'Mini Series EP2', c.id, p.id, 'READY_FOR_REVIEW', 0, 'https://frame.io/ep2', 1
FROM clients c JOIN projects p ON p.client_id = c.id AND p.name = 'Mini Series' WHERE c.name = 'Taryn';
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-08-31', 'Mini Series EP3', c.id, p.id, 'IN_PROGRESS', 0, 0
FROM clients c JOIN projects p ON p.client_id = c.id AND p.name = 'Mini Series' WHERE c.name = 'Taryn';
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-09-01', 'Mini Series EP4', c.id, p.id, 'PLANNED', 0, 0
FROM clients c JOIN projects p ON p.client_id = c.id AND p.name = 'Mini Series' WHERE c.name = 'Taryn';

-- Dave: one clean delivered video.
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, delivery_url, revisions_count)
SELECT '2026-08-25', 'Product Launch Cut', c.id, p.id, 'DONE', 1, 'https://drive.example.com/dave', 0
FROM clients c JOIN projects p ON p.client_id = c.id WHERE c.name = 'Dave';

-- Shelley: one in-progress video, no contract.
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-08-29', 'Brand Reel Cut 1', c.id, p.id, 'IN_PROGRESS', 0, 0
FROM clients c JOIN projects p ON p.client_id = c.id WHERE c.name = 'Shelley';

-- RMedia Internal: internal video, must never show up in customer economics.
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-08-15', 'Internal Reel v1', c.id, p.id, 'IN_PROGRESS', 0, 0
FROM clients c JOIN projects p ON p.client_id = c.id WHERE c.name = 'RMedia Internal';

-- Test Client edge cases: one blocked video with multiple revisions
-- (one OUR_ERROR -- avoidable QA failure), one video with zero work
-- sessions (missing evidence).
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-08-10', 'Edge Case Blocked Cut', c.id, p.id, 'CHANGES_REQUESTED', 0, 2
FROM clients c JOIN projects p ON p.client_id = c.id WHERE c.name = 'Test Client';
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, revisions_count)
SELECT '2026-08-18', 'Edge Case No Evidence Cut', c.id, p.id, 'IN_PROGRESS', 0, 0
FROM clients c JOIN projects p ON p.client_id = c.id WHERE c.name = 'Test Client';

-- Work sessions: closed sessions on Taryn EP1/EP2/EP3 (real evidence),
-- and one deliberately STALE open session on the Test Client blocked
-- video (started 9 hours ago, never stopped) to exercise the Work
-- Session Guardian's stale badge + quick-switch.
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('2026-08-20 09:00:00'), unixepoch('2026-08-20 13:00:00'), 'EDITING', 'EP1 first cut'
FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('2026-08-27 10:00:00'), unixepoch('2026-08-27 12:30:00'), 'EDITING', 'EP2 cut'
FROM video_logs WHERE title = 'Mini Series EP2';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('2026-08-31 09:00:00'), unixepoch('2026-08-31 11:00:00'), 'EDITING', 'EP3 first pass'
FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note)
SELECT id, unixepoch('now', '-9 hours'), NULL, 'EDITING', 'Forgot to stop -- stale fixture'
FROM video_logs WHERE title = 'Edge Case Blocked Cut';

-- Revisions: Taryn EP2 client-requested change (friction, not our error).
-- Test Client blocked video: two revisions, one OUR_ERROR (avoidable QA
-- failure), one CLIENT_CHANGE.
INSERT INTO revisions (video_id, note, actor, caused_by, created_at)
SELECT id, 'Client asked for a different intro pace', 'client', 'CLIENT_CHANGE', unixepoch('2026-08-28 09:00:00')
FROM video_logs WHERE title = 'Mini Series EP2';
INSERT INTO revisions (video_id, note, actor, caused_by, created_at)
SELECT id, 'Wrong logo version used -- our mistake', 'admin', 'OUR_ERROR', unixepoch('2026-08-11 09:00:00')
FROM video_logs WHERE title = 'Edge Case Blocked Cut';
INSERT INTO revisions (video_id, note, actor, caused_by, created_at)
SELECT id, 'Client changed brand colors mid-project', 'client', 'CLIENT_CHANGE', unixepoch('2026-08-14 09:00:00')
FROM video_logs WHERE title = 'Edge Case Blocked Cut';

-- Commitments: Taryn waiting-on-client (open, due soon, not yet overdue)
-- and one already-done historical commitment. Test Client: one overdue
-- open commitment (the "overdue" fixture the brief asks for) and one
-- blocked-project commitment.
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, source, actor, created_at, completed_at)
SELECT 'CLIENT', id, 'Send EP2 review link and follow up', unixepoch('2026-09-05 00:00:00'), 'OPEN', 'MANUAL', 'admin', unixepoch('2026-08-27 12:00:00'), NULL
FROM clients WHERE name = 'Taryn';
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, source, actor, created_at, completed_at)
SELECT 'VIDEO', id, 'Deliver EP1 final cut', unixepoch('2026-08-20 18:00:00'), 'DONE', 'MANUAL', 'admin', unixepoch('2026-08-18 09:00:00'), unixepoch('2026-08-20 14:00:00')
FROM video_logs WHERE title = 'Mini Series EP1';
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, source, actor, created_at, completed_at)
SELECT 'PROJECT', id, 'Resolve blocked revisions and reply to client', unixepoch('2026-08-22 00:00:00'), 'OPEN', 'MANUAL', 'admin', unixepoch('2026-08-15 09:00:00'), NULL
FROM projects WHERE name = 'Edge Case Project';
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, source, actor, created_at, completed_at)
SELECT 'CLIENT', id, 'Send contract for signature', unixepoch('2026-08-25 00:00:00'), 'OPEN', 'MANUAL', 'admin', unixepoch('2026-08-20 09:00:00'), NULL
FROM clients WHERE name = 'Test Client';
