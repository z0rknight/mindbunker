# Operating Intelligence & Evidence Readiness — Release Train (2026-09-19 operator-local)

## 1. Source snapshot
GREEN. HEAD = release = `production/current` = `332da98ec`; migration head 0052, none pending; Operator `7bacbe7c…`, Client `6a619197…`; Sensor untouched (two local Sensor worktrees observed, not modified).

## 2. Shared archaeology map (one pass)
| Class | Item |
|---|---|
| FACT | `device_activity_observations` (app, bundle, interval, idle, no window title); `sensor_sessions` (context CLIENT/LEAD/INTERNAL/ADMIN, approval state); `work_sessions`; `billing_evidence` rows sourced from Upwork reports (registered minutes × rate); `billing_allocations`; `transactions` (income = payment layer); `revisions.caused_by`; `video.note_added` events |
| DERIVED | app normalisation; observed vs intentional app time; session coverage; order time breakdown; batch evidence; batch-equivalent average |
| PROJECTION | Application usage (Sensor Activity), Production Order evidence block |
| UNKNOWN | web surface inside a browser; phase (rough cut vs captions); per-batch registered time and payment; who a given Upwork week was "for" |

## 3. Application telemetry coverage (production, read-only)
11,075 observations, 1 device, Aug 24 → Sep 20 (28 days): 549.2 h total = 247.2 h active + 302.0 h idle; 57 apps; every row has a bundle id; **0 rows have a window title**; no overlapping observations; 197 zero-length rows (harmless); longest active interval 1.3 h. Top active apps: Safari 133.6 h (54%), Premiere 36.9 h, Notion 24.4 h, Claude 14.0 h. ActivityWatch import: 0 events; Screen Time snapshots: 0. **Browser surface attribution is UNSUPPORTED**: without window titles, Safari time cannot be split by site (Safari + a ChatGPT page stays Safari). Capturing titles would need a Sensor change and a privacy decision; not recommended without one.

## 4. Observed vs intentional model
Application usage already existed (earlier Sensor ledger wave: bundle-id normalisation, surface classifier, windows Today / 3d / 7d / last week / month, observed vs intentional). Gaps found and fixed in this train:
- **DELETED sessions were counted** as intentional time (latent: 0 deleted today). Now excluded.
- **Overlapping sessions could double-count** foreground time (e.g. after a correction). Sessions are now resolved chronologically before intersecting.
- **No coverage disclosure for intentional time.** Now shown: intentional sessions, telemetry coverage, active vs idle inside sessions, and time with **no telemetry ("unknown, not zero")**; plus a note that browser surface is not attributed because titles are not collected.
Production magnitudes: intentional sessions 240.6 h (67 approved client 149.8 h + 18 archived internal 90.8 h + 1 trivial), telemetry covers 208.9 h (87%), of which active app time 123.9 h and idle-while-session-open 85.0 h; 31.7 h has no telemetry. No cache: everything is derived at read time, so a corrected session changes the overlap on the next read (tested). No scores, judgement or gamification.

## 5. Economics evidence coverage
Taryn: Upwork registered **69.5 h** (4,170 min, Jul 27–Sep 13, $25/h); allocated to videos **90 min (2.2%)**; **unallocated 4,080 min (97.8%)**. Tracked Work Sessions ≈36.8 h; approved Sensor time on deliverables ≈57 h (periods not aligned; magnitudes only). All-client Work Sessions: 61 from approved Sensor sessions (101.2 h) + 16 manual (27.7 h) = 128.9 h. Payments: 5 Taryn income transactions, $1,372.50 (client level only). Revisions recorded: **0** (0 by cause). One Production Order with time (n = 1).
**What can be measured honestly:** observed/intentional app time, Sensor coverage, Work Session time per video/batch (with its Sensor-observed share), billing allocated to a batch. **Missing:** per-batch registered time, per-batch payment, phase, revision burden, more than one batch sample. **Smallest next evidence improvements (not built):** (1) explicit weekly allocation of Upwork minutes to a batch only when the operator knows it (unallocated is valid; never proportional); (2) record revision cause when a revision happens (control shipped last train); (3) if phase matters later, prefer app-mix as a hint over a mandatory field, and only then propose an additive nullable `work_sessions.phase` — needs approval, not proposed for now.

## 6. External registered-time semantics
Upwork weekly reports live in `billing_evidence` (registered minutes, rate, gross, source UPWORK_REPORT). Semantically they are **EXTERNAL REGISTERED TIME**, not an invoice, not billing confirmation, not payment, not revenue; payment is the separate `transactions` layer. The table name is historical; no rename (would need a migration). The batch evidence block states this explicitly: registered time is reported weekly per contract and is **not attributed to a batch**. The historical proportional allocation (9 rows / 90 min) is evidence-specific and is not extended.

## 7. Batch evidence (delivered)
Read-only block on the Production Order page: deliverables, tracked work (batch-level and per-video kept separate) with the **Sensor-observed part** (approved Sensor sessions ARE the origin of some Work Sessions, so it is a share of tracked time, never added), a **BATCH-EQUIVALENT AVERAGE** only when all time is at batch level (never written to a video), billing evidence allocated, external registered time and payment stated as unattributed, and "no profit figure". The 17SEP batch: 4 deliverables (3 done), 3.10 h batch-level (all Sensor-observed) → ≈47 min batch-equivalent, n = 1. **No profitability number was created.**

## 8. Quick Notes harvest (37 reviewed; nothing created or changed)
26 stay as production diary. Surviving items (9): (1) Dave Meta-ads brief — **CANONICALIZED** (project 8 "Meta Ads - September" already holds the same brief with the Canva and Dropbox links); (2) Dave "Landing Page" delivery link — canonical home `video_logs.delivery_url` exists but is **empty**: **CURRENT FOLLOW-UP**, one-time correction proposed (needs approval: that field is visible in the client portal); (3) Wise payment link — **SUPERSEDED** (Dave's $100 payment is recorded); (4) send-final-audio commitment — **SUPERSEDED** (video DONE, no open commitment); (5) timer notes — see §9; (6) 4K pixels / lighting observation — **UNKNOWN** (no follow-up recorded); (7) camera-movement plan and glow idea — **SUPERSEDED** (glow approved in the same session); (8) registered-time checkpoints (1h10 → 3h51) — **CANONICALIZED** by the weekly Upwork evidence (Aug 17–23: 1,170 min); (9) internal Sensor-wave note — **SUPERSEDED**. Stranded facts: 2; written this train: 0.

## 9. Timer-note verdict
**STILL REAL, display-only.** The web timer counts up from `startedAt` and never re-validated, so a session stopped on another device kept "running" here until a manual refresh; the database was always correct and Sensor's own sessions are separate. Fixed in this train (no Sensor change): the shared focus panel now re-checks the server when the tab becomes visible or focused (throttled to once per 15 s). Verified locally: session closed in the DB → tab refocus → the running session disappears without a reload; a second event within 15 s is throttled.

## 10. Selected slices and intentionally not built
Slices (3): application-usage honesty; batch evidence block; timer display re-sync. Not built: BI dashboard, Pricing Lab / Offer Generator, productivity/focus scores, mandatory phase logging, web-surface capture, allocation automation, Quick Notes management, any migration.

## 11. Tests, gates
New: 22 targeted (11 coverage/overlap/disclosure + 11 evidence/boundary/timer pins); one existing test that documented the old double-count weakness was updated. Full gate once: `git diff --check` clean; **1351/1351**; `tsc` clean; `eslint` 0 errors (3 pre-existing warnings); build exit 0.

## 12. Deploy and authority
One deploy: Operator `40e1d189-502e-4e45-be3c-5dcada4ee7fe` (from `9417329`); rollback `7bacbe7c-c712-44f3-abba-706326352666`. No migration; no D1 writes by this train (production counts moved only through the Sensor's own live sync). Client, Sensor, public site untouched. HEAD = release = `production/current` at `9417329` before this report-only commit.

## 13. Functional QA
Local sandbox with a purpose-built fixture (overlapping sessions, a DELETED session over Safari time, a session with no telemetry, a Sensor-approved and a manual container session): intentional Premiere 1h40m / Safari 30m (deleted and overlap not counted); coverage line reconciles; windows Today/3d/7d/month load; order evidence block shows batch-level 1h30m with Sensor part 1h, ≈18m batch-equivalent, everything external stated as unattributed. Fixtures restored. **Production authenticated UI: not required** (deterministic UI; production data verified read-only; deploy reachability confirmed).

## 14. Pricing-Lab readiness: NOT READY
Type of work (Taryn's videos are all one content type), historical time (one batch sample, mixed tracking), price (hourly contract + one quote), revision burden (0 recorded), capacity (Sensor coverage: partial, 28 days). The evidence supports describing the work, not pricing it without false precision.
