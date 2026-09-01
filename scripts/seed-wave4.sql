-- Wave 4 fixture expansion. LOCAL D1 ONLY. Builds on Wave 1-3 fixtures
-- already seeded for Taryn/Dave/Shelley/RMedia Internal/Test Client.
-- Nothing here touches production, remote D1, or Cloudflare.

-- ============================================================
-- TARYN EP3 -- Wave 4 continuation of the Wave 3 dogfood flow
-- ============================================================

-- 4E: Project-level canonical tags for Mini Series (Taryn).
UPDATE projects SET tags = 'MINI, TARYN, VERTICAL' WHERE name = 'Mini Series';

-- 4F: Production checklist for EP3 -- reflects where the video actually
-- stands mid-edit at the point the Wave 4 dogfood flow begins.
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'ASSEMBLY', 'DONE', unixepoch('2026-09-01 09:40:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'COLOR', 'DONE', unixepoch('2026-09-01 12:15:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'AUDIO', 'NOT_STARTED', NULL FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'MOTION', 'DONE', unixepoch('2026-09-01 12:15:00') FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'CAPTIONS', 'NOT_STARTED', NULL FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'QA', 'NOT_STARTED', NULL FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'EXPORT', 'NOT_STARTED', NULL FROM video_logs WHERE title = 'Mini Series EP3';
INSERT INTO production_checklist_items (video_id, step, status, toggled_at)
SELECT id, 'DELIVERY', 'NOT_STARTED', NULL FROM video_logs WHERE title = 'Mini Series EP3';

-- 4O: Capture Inbox mental note logged mid-session (uncategorized, P2, unowned).
INSERT INTO action_items (title, priority, status, source, created_at)
VALUES ('Ask Taryn about outro music license before final export', 'P2', 'OPEN', 'INBOX', unixepoch('2026-09-01 13:05:00'));

-- Switch activity: new work session, AUDIO pass on EP3.
INSERT INTO work_sessions (video_id, started_at, ended_at, activity_type, note, integrity_state)
SELECT id, unixepoch('2026-09-01 13:10:00'), unixepoch('2026-09-01 14:05:00'), 'AUDIO', 'Audio pass after motion graphics', 'NORMAL'
FROM video_logs WHERE title = 'Mini Series EP3';

-- New blocker distinct from the Wave 3 B-roll one: waiting on a client
-- decision on intro text, resolved same afternoon.
INSERT INTO blockers (category, owner_type, owner_id, note, started_at, resolved_at, actor)
SELECT 'DECISION', 'VIDEO', id, 'Waiting on Taryn to confirm intro text wording', unixepoch('2026-09-01 13:20:00'), unixepoch('2026-09-01 13:50:00'), 'admin'
FROM video_logs WHERE title = 'Mini Series EP3';

-- Production checklist: AUDIO now done.
UPDATE production_checklist_items SET status = 'DONE', toggled_at = unixepoch('2026-09-01 14:05:00')
WHERE step = 'AUDIO' AND video_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3');

-- 4I: QA fail, OUR_ERROR, with revision detail (category + minutesRework).
INSERT INTO qa_events (video_id, result, checklist, override_reason, caused_by, actor, created_at)
SELECT id, 'FAIL', '{"names":true,"spelling":true,"captions":true,"audio":false,"color":true,"assets":true,"playback":true}', NULL, 'OUR_ERROR', 'admin', unixepoch('2026-09-01 14:10:00')
FROM video_logs WHERE title = 'Mini Series EP3';

INSERT INTO revisions (video_id, note, actor, caused_by, category, minutes_rework, created_at)
SELECT id, 'Audio levels inconsistent between B-roll and interview segments -- remixed and re-leveled', 'admin', 'OUR_ERROR', 'AUDIO', 25, unixepoch('2026-09-01 14:35:00')
FROM video_logs WHERE title = 'Mini Series EP3';
UPDATE video_logs SET revisions_count = revisions_count + 1, updated_at = unixepoch('2026-09-01 14:35:00') WHERE title = 'Mini Series EP3';

-- Production checklist: QA/CAPTIONS/EXPORT now done after the fix.
UPDATE production_checklist_items SET status = 'DONE', toggled_at = unixepoch('2026-09-01 15:00:00')
WHERE step = 'CAPTIONS' AND video_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3');
UPDATE production_checklist_items SET status = 'DONE', toggled_at = unixepoch('2026-09-01 15:10:00')
WHERE step = 'EXPORT' AND video_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3');

-- QA pass, clean.
INSERT INTO qa_events (video_id, result, checklist, override_reason, caused_by, actor, created_at)
SELECT id, 'PASS', '{"names":true,"spelling":true,"captions":true,"audio":true,"color":true,"assets":true,"playback":true}', NULL, NULL, 'admin', unixepoch('2026-09-01 15:15:00')
FROM video_logs WHERE title = 'Mini Series EP3';
UPDATE production_checklist_items SET status = 'DONE', toggled_at = unixepoch('2026-09-01 15:15:00')
WHERE step = 'QA' AND video_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3');

-- New commitment for the final delivery + live link, opened then closed
-- by the delivery below (the Wave 3 "rough cut" commitment is already DONE).
INSERT INTO commitments (owner_type, owner_id, description, due_at, status, actor, created_at, completed_at)
SELECT 'VIDEO', id, 'Deliver EP3 final cut + live link to Taryn', unixepoch('2026-09-01 18:00:00'), 'DONE', 'admin', unixepoch('2026-09-01 13:00:00'), unixepoch('2026-09-01 15:40:00')
FROM video_logs WHERE title = 'Mini Series EP3';

-- 4J: Delivery + live URL. Final published link distinct from review/delivery URL.
UPDATE video_logs
SET status = 'DONE', delivered = 1,
    review_url = 'https://frame.io/mindbunker/taryn-ep3-review',
    delivery_url = 'https://drive.google.com/taryn-ep3-final',
    published_url = 'https://youtube.com/watch?v=taryn-mini-ep3',
    updated_at = unixepoch('2026-09-01 15:40:00')
WHERE title = 'Mini Series EP3';
UPDATE production_checklist_items SET status = 'DONE', toggled_at = unixepoch('2026-09-01 15:40:00')
WHERE step = 'DELIVERY' AND video_id = (SELECT id FROM video_logs WHERE title = 'Mini Series EP3');

INSERT INTO deliveries (video_id, commitment_id, version, delivered_at, delivery_url, note, status, actor)
SELECT v.id, c.id, 1, unixepoch('2026-09-01 15:40:00'), 'https://drive.google.com/taryn-ep3-final', 'EP3 final cut delivered + live link sent', 'DELIVERED', 'admin'
FROM video_logs v
JOIN commitments c ON c.owner_type = 'VIDEO' AND c.owner_id = v.id AND c.description = 'Deliver EP3 final cut + live link to Taryn'
WHERE v.title = 'Mini Series EP3';

-- ============================================================
-- INGESTION (4T) -- close the Wave 3 gap with a real recorded event.
-- ============================================================
INSERT INTO ingestion_events (video_id, source, destination, started_at, completed_at, operator_minutes, machine_minutes, blocked_work)
SELECT id, 'Sony A7 IV SD card', 'TrueNAS media share', unixepoch('2026-09-01 08:45:00'), unixepoch('2026-09-01 09:00:00'), 8, 22, 0
FROM video_logs WHERE title = 'Mini Series EP3';

-- ============================================================
-- SYSTEM ROI DOGFOOD (4U) -- one real recorded intervention.
-- ============================================================
INSERT INTO system_interventions (name, problem, before, after, related_friction_category, created_at)
VALUES (
  'TrueNAS for media storage',
  'Local SSD kept filling mid-project; ingest required active babysitting and repeated manual cleanup.',
  'Ingest averaged ~30-40min operator-attended copying to a nearly-full internal SSD; at least one FILES blocker/week tied to storage.',
  'Ingest is now a background NAS copy -- operator-minutes dropped to ~8min hands-on per event (see ingestion_events row above), zero FILES blockers logged against storage since the switch.',
  'FILES',
  unixepoch('2026-09-01 16:00:00')
);

-- ============================================================
-- CLAIMS DOGFOOD (4V) -- real evidence, no auto-upgraded hypotheses.
-- ============================================================
INSERT INTO claims (statement, type, confidence, evidence_needed, source_refs, status, created_at)
VALUES (
  'Dave''s fixed-price work has a higher effective hourly rate than Taryn''s hourly editing.',
  'HYPOTHESIS', 'LOW',
  'Compare tracked work-session hours vs. contract/invoice value per client over 60+ days',
  NULL, 'OPEN', unixepoch('2026-09-01 16:05:00')
);
INSERT INTO claims (statement, type, confidence, evidence_needed, source_refs, status, created_at)
VALUES (
  'Missing-asset friction (B-roll/logo) recurs on nearly every Taryn episode.',
  'INFERENCE', 'MEDIUM',
  NULL,
  'friction_events category=FILES tied to Mini Series project/videos, 2+ occurrences in a single week (2026-08-31 to 2026-09-01)',
  'OPEN', unixepoch('2026-09-01 16:07:00')
);

-- ============================================================
-- OBJECTIVE (4Q)
-- ============================================================
INSERT INTO objectives (title, period, status, target_text, current_text, linked_project_id, linked_client_id, created_at)
SELECT
  'Ship Mini Series EP3-EP4 without a missing-asset blocker',
  'Sep 2026', 'ACTIVE',
  'Zero FILES blockers on Taryn videos for the rest of the month',
  '1 FILES blocker + 1 DECISION blocker resolved on EP3 so far; NAS intervention live as of today',
  p.id, c.id, unixepoch('2026-09-01 16:10:00')
FROM projects p JOIN clients c ON c.name = 'Taryn'
WHERE p.name = 'Mini Series';

-- ============================================================
-- VIDEO IDEA / PITCH (4G) -- internal idea, not yet a real production video.
-- ============================================================
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, video_kind, idea_stage, pitch, intended_format, created_at, updated_at)
SELECT '2026-09-01', 'Behind-the-Scenes: Editing Bay Tour', c.id, NULL, 'PLANNED', 0, 'INTERNAL', 'PROPOSED',
  'Short vertical BTS piece showing the actual edit bay/workflow -- reusable as a sample for prospective clients and as social content.',
  'Vertical, 60s, INTERNAL',
  unixepoch('2026-09-01 16:15:00'), unixepoch('2026-09-01 16:15:00')
FROM clients c WHERE c.name = 'RMedia Internal';

-- ============================================================
-- LEAD FIXTURE (4S) -- new lead, sample video, interaction, follow-up,
-- opportunity progression, to dogfood the CRM State Machine / Follow-up
-- Clock / Sample Video / Contact Timeline / Action Radar together.
-- ============================================================
INSERT INTO clients (name, status, email, source, contacted, converted, opportunity_stage, service_interest, qualification_notes, next_action, next_action_date, last_interaction_at, created_at)
VALUES (
  'Priya Chen', 'lead', 'priya.chen@example.com', 'Instagram DM', 1, 0,
  'qualified', 'Short-form brand video series', 'Runs a skincare brand, ~15k followers, wants 4-6 vertical videos/month.',
  'Send sample reel + rate card', '2026-09-03', unixepoch('2026-09-01 11:00:00'), unixepoch('2026-08-30 10:00:00')
);

-- Sample video (must NOT count toward revenue) linked to the lead.
INSERT INTO video_logs (date, title, client_id, project_id, status, delivered, video_kind, created_at, updated_at)
SELECT '2026-09-01', 'Priya Chen -- Sample Reel', id, NULL, 'DONE', 1, 'SAMPLE_VIDEO', unixepoch('2026-09-01 11:05:00'), unixepoch('2026-09-01 11:05:00')
FROM clients WHERE name = 'Priya Chen';

UPDATE video_logs SET published_url = 'https://youtube.com/watch?v=mindbunker-sample-reel'
WHERE title = 'Priya Chen -- Sample Reel';

-- Interaction log (first contact).
INSERT INTO crm_events (client_id, video_id, type, actor, description, created_at)
SELECT id, NULL, 'dm', 'admin', 'Inbound DM: interested in a recurring short-form video package for her skincare brand.', unixepoch('2026-08-30 10:00:00')
FROM clients WHERE name = 'Priya Chen';

-- Interaction log (sample sent) -- linked to the sample video for the
-- Contact Timeline to show video + interaction together.
INSERT INTO crm_events (client_id, video_id, type, actor, description, created_at)
SELECT c.id, v.id, 'note', 'admin', 'Sent sample reel and a rough rate card. Follow up 2026-09-03 if no reply.', unixepoch('2026-09-01 11:10:00')
FROM clients c JOIN video_logs v ON v.title = 'Priya Chen -- Sample Reel'
WHERE c.name = 'Priya Chen';

-- Radar item to actually follow up (distinct from Capture Inbox -- this
-- one is pre-classified against the lead, not an unowned inbox note).
INSERT INTO action_items (title, priority, status, owner_type, owner_id, source, due_at, created_at)
SELECT 'Follow up with Priya Chen on sample reel', 'P1', 'OPEN', 'CLIENT', id, 'MANUAL', unixepoch('2026-09-03 12:00:00'), unixepoch('2026-09-01 11:10:00')
FROM clients WHERE name = 'Priya Chen';
