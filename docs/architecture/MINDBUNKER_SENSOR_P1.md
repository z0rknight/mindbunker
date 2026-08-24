# MindBunker Sensor P1.1 — Inbox, Review, and Observation Sync

MindBunker Sensor remains a separate native SwiftUI menu-bar application. This local candidate adds a narrow, revocable device bridge without changing the Client → Project → Video attribution spine.

## Server additions

- `sensor_devices`: device public identity, SHA-256 token hash, fixed scopes, last seen, revocation.
- `work_sessions.sensor_device_id` and `sensor_local_id`: nullable provenance/idempotency fields. Existing WEB_TIMER rows remain unchanged; approved native sessions use `MAC_SENSOR_APPROVED`.
- `device_activity_observations`: append-only passive app/idle intervals, separate from intentional Work Sessions.
- `sensor_sessions`: durable native intentional-session evidence with `PENDING`, `APPROVED`, `ARCHIVED`, and `DELETED` review states.
- `/api/sensor/v1/catalog`, `/sessions/start`, `/sessions/stop`, and `/observations`.
- `/productivity/sensor`: authenticated Inbox, passive evidence, diagnostics, reviewed history, and credential management.
- `/productivity/sensor/sessions/[id]`: client/project/video/session facts plus timestamp-overlap application and input-signal projection.

## Invariants

- The canonical Video ID is the only device-supplied attribution authority; Project and Client are derived.
- Sensor Start/Stop writes `sensor_sessions`; it never creates a canonical Work Session implicitly.
- Approve promotes one completed pending Sensor session into exactly one canonical Work Session. Device/local UUID uniqueness and the review link make retries idempotent.
- Archive hides evidence from active review without deleting it. Manual Delete is a separate confirmed soft-delete state, so telemetry is retained.
- The existing one-global-open-work-session partial unique index remains authoritative for canonical browser/approved Work Sessions.
- Per-device local UUID uniqueness makes at-least-once retries idempotent.
- Passive activity exists with or without a Work Session and is never stored in `work_sessions`.
- Correlation is a timestamp-overlap query, not persisted state.
- Window-title and aggregate-input uploads are independently opt-in and off by default. Raw keys/text/coordinates have no schema or API representation.

## Observation sync audit

The missing-app symptom was not a projection bug. The native SQLite database contained Notion, Claude, ChatGPT, and other apps, but historical closed rows created before the durable outbox existed had `sync_status = LOCAL_ONLY` and no `OBSERVATION_UPSERT` item. In addition, no active local credential/endpoint meant queued rows could not leave the Mac.

Native startup now repairs every closed unsynced observation into the outbox idempotently. Preferences reports local, uploaded, pending, rejected, and last-successful-upload values. A local end-to-end run proved Notion, Claude, ChatGPT, Finder, Safari, and Premiere survive SQLite → outbox → batched API → D1 → UI. Window titles and aggregate input counters remain independent opt-ins; NULL counters remain “Not measured”.

## Future project ledger

Project name → project-specific Work Session Ledger is a derived filter over `work_sessions → video_logs → projects`. It needs no duplicated project ID on sessions and is deliberately deferred.

## Release boundary

Migration `0020_sensor_inbox_p11.sql` is additive and locally validated across `0000–0020` with zero FK violations. It also backfills already-synced legacy `MAC_SENSOR` Work Sessions into approved Sensor evidence and normalizes their source to `MAC_SENSOR_APPROVED`. No remote migration, Worker upload, production credential, or production data mutation occurred in P1.1.
