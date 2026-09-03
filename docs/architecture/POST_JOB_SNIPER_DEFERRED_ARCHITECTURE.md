# Post-Job Commercial + Delivery Sniper — Deferred Architecture Notes

Written 2026-09-03, alongside the Post-Job Commercial + Delivery Sniper
patch. Covers the two items the brief explicitly allowed to be
"research + document, implement only if trivially safe, otherwise defer":
Work Unit vs Deliverable (§13) and Sensor + Web duplicate evidence (§14).
Neither was implemented this round -- both would require a real schema
change, which the brief explicitly says not to attempt in this sniper
wave. This note exists so the next wave does not have to re-derive the
investigation.

## §13 — WORK UNIT ≠ DELIVERABLE

**The real scenario.** `MetaAds_A` and `MetaAds_B` are two `video_logs`
rows sharing almost the same edit: one 46-minute editing operation plus a
small hook change for the B variation. Today, tracked time can only be
logged against ONE video per work session (`work_sessions.video_id` is
`NOT NULL`, single FK, no group concept). Two false options exist under
the current schema:

- Log the 46 minutes against `MetaAds_A` only → `MetaAds_B` reads as
  0m of tracked work, which is false; real work produced it.
- Log 46 minutes against *each* video → the shared edit is now double-
  counted as 92 minutes of labor, which inflates both tracked time and
  (via the Commercial Value Engine this round built) estimated accrued
  value for an HOURLY contract. This is exactly the "NEVER double-count
  time" invariant the brief opens with.

**What exists today that's adjacent but not this.** `video_logs.batchLabel`
(free-text, Local Lab bulk-ingest) groups videos that were *created*
together in one submission -- it says nothing about shared *work* and two
videos from different batches can still share an edit. `video_logs.tagsOverride`
is a per-video tag override, unrelated. There is no `parent_video_id`,
no `production_group_id`, and no project-level (as opposed to video-level)
work session anywhere in `schema.ts`. Nothing safe to repurpose exists.

**Why this was not implemented now.** The only honest fix is a real
schema addition: either (a) a nullable `work_sessions.shared_with_video_ids`
-type structure, or (b) a `production_groups` table with a `video_id`
join table and a work-session-to-group FK, with the app-level rule that
group tracked-time is attributed to the GROUP, not summed per member
video. Either shape changes how every existing consumer of
`videoClosedSeconds` (the Commercial Value Engine's tracked-time input,
built this round) must query -- video-level or group-level, and how the
Video Workspace displays "shared work" honestly. That is real new
attribution architecture, not a "sniper" patch.

**Smallest future schema** (for whoever picks this up):

```
production_groups (id, project_id, label, created_at)
production_group_videos (production_group_id, video_id)   -- join table
work_sessions.production_group_id  -- nullable, alternative to video_id
```

A work session would carry EITHER a `video_id` (today's shape, unchanged)
OR a `production_group_id` (new), never both -- and `videoClosedSeconds`
for a video that belongs to a group would need to decide whether to
report "this video's own tracked time" (0, honestly) or "the group's
tracked time" (46m, shared) as a clearly labeled, DIFFERENT number from
per-video tracked time. That labeling decision needs the operator's
input on the actual UI, which is why it's deferred rather than guessed.

## §14 — Sensor + Web duplicate evidence

**The real risk.** `work_sessions` (WEB_TIMER, manually started/stopped
by the operator) and `sensor_sessions` (MAC_SENSOR, captured
automatically by the Mac sensor) are two independent evidence sources
that can both describe the same real-world work event -- same workstation,
same video, overlapping wall-clock time. `approveSensorSession`
(`modules/sensor/actions.ts`) already turns an approved sensor session
into a REAL `work_sessions` row (linked back via
`sensor_sessions.approved_work_session_id`) -- this is a manual,
operator-gated step, not automatic. But nothing checks, at approval time
or at read time, whether the sensor session's time window already
overlaps an existing WEB_TIMER `work_sessions` row for the same video.
`videoClosedSeconds` (`VIDEO_WORK_SESSION_SUMMARY_SQL`,
`modules/work-sessions/data.ts`) sums ALL closed `work_sessions` rows for
a video with no overlap awareness -- if an operator manually timed 30
minutes AND later approves a sensor session covering the same 30 minutes,
`videoClosedSeconds` reports 60 minutes, and the Commercial Value Engine
this round built (tracked time × contract rate) would silently inflate
the estimated accrued value on that fact.

**Why no fix shipped this round.** The brief is explicit: raw evidence
(`work_sessions`, `sensor_sessions`) must never be deleted or merged --
custody stays intact. A safe fix is therefore READ-TIME dedup only: when
summing tracked seconds for a video, detect overlapping intervals across
`WEB_TIMER` and `MAC_SENSOR`-sourced rows and count the union of the
intervals, not the sum of the durations. That is a real algorithm
(interval-merge) touching the one function (`videoClosedSeconds`) that
the entire Commercial Value Engine, Productivity, Dashboard, and War Room
now depend on -- correctness here is load-bearing for real money-shaped
numbers, and it was not something to prototype in the same pass as first
building the engine that depends on it. It needs its own pass with
dedicated overlap regression tests (adjacent-but-not-overlapping,
fully-nested, partially-overlapping, exact-duplicate) before touching the
one summary query every commercial-value figure in this app now reads.

**Preferred future architecture** (unchanged from the brief's own framing,
confirmed still correct after this investigation): EVIDENCE SESSION
(`work_sessions` + `sensor_sessions`, both kept exactly as recorded,
forever) → CANONICAL WORK INTERVAL (a derived, read-time-only union of
overlapping evidence windows, computed fresh on every query, never
stored/materialized so it can never drift from the raw evidence it's
derived from).
