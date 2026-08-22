# Work Session Integration Readiness

Status: design review only. This document does not authorize a schema, importer, sensor handshake, or production integration.

## Current attachment spine

MindBunker already has the stable canonical identifiers needed for attribution:

| Entity | Stable identifier | Current ownership |
|---|---|---|
| Client | `clients.id` | Relationship and commercial counterparty |
| Project | `projects.id` | Work commitment owned by exactly one client |
| Video | `video_logs.id` | Canonical production unit; may currently be standalone |

A future normalized work session could attach cleanly to this hierarchy. The most specific confirmed attribution should win: a video implies its current project and client; a project implies its client. The server must derive those ancestors and reject contradictory assignments rather than storing three independent claims.

## Nullability and confirmation

- `client_id`, `project_id`, and `video_id` should remain nullable on imported source facts because passive telemetry may not initially be attributable.
- Unattributed does not mean unproductive, and it must not be silently assigned to the most recent open project.
- Source timestamps and source identity are facts. Attribution is an operator decision or a transparent suggestion.
- Automatic suggestions may carry confidence and reasons, but ambiguous attribution must remain human-confirmed.
- A low-confidence match must never change a canonical client, project, or video automatically.

## Source identity

External sources must remain distinguishable at row level:

- Upwork: contract-oriented tracker and billing context.
- Clockify: manual/timer-based work records and user-entered descriptions.
- ActivityWatch: passive application/window activity.
- Activity Sensor: future first-party operational telemetry.

At minimum, a future source fact needs a source discriminator and a source-specific stable reference. The identity boundary should conceptually be `(source, raw_source_reference)`, not a globally trusted external ID.

## Overlap and deduplication risks

The same real interval can appear in several systems:

- an Upwork tracked interval overlapping a Clockify timer;
- Clockify covering the same period observed by ActivityWatch;
- ActivityWatch and Activity Sensor observing the same desktop activity;
- manual corrections that overlap original timer data;
- multiple apps/windows reporting activity during one human work interval;
- time-zone conversion or clock drift shifting otherwise identical intervals;
- idle detection and pause semantics differing by source.

These observations are evidence about one interval, not necessarily separate work.

## Time that must never be treated as additive

- Overlapping wall-clock intervals from different sources.
- Concurrent window/application activity from the same machine.
- Passive observation inside an already confirmed manual timer.
- Idle time merely because an application remained open.
- Upwork and Clockify records for the same delivered work without interval reconciliation.
- A source summary plus its underlying detailed records.
- Revised/exported copies of an earlier source record.

No daily or project total is truthful until intervals have been normalized, deduplicated, and attributed.

## Future persistence versus application logic

Likely future migration needs, after sample exports are inspected:

- immutable or append-only source facts with source identity and raw timestamps;
- a normalized canonical interval/work-session representation;
- explicit attribution state and operator confirmation metadata;
- indexes for interval overlap, source identity, and canonical attachments;
- possibly a source import ledger for idempotency and traceability.

Application-level logic can remain responsible for:

- interval normalization and time-zone conversion;
- candidate matching and confidence explanations;
- overlap visualization;
- operator confirmation UI;
- derived duration and rollups;
- source-specific adapters.

Do not persist derived totals merely to make a dashboard convenient.

## Decisions that must wait for real exports

- Timestamp precision and timezone behavior for every source.
- Whether source IDs survive re-export and edits.
- How pauses, idle time, offline time, and deleted records are represented.
- Whether Upwork exports expose intervals or only summaries.
- Whether Clockify edits create new versions or mutate existing records.
- ActivityWatch event granularity and bucket identity.
- Activity Sensor event and device identity.
- Whether raw payload retention is necessary, safe, and proportionate.
- The smallest useful operator workflow for confirming attribution.

## Readiness conclusion

The existing Client → Project → Video spine is ready to receive future attribution references without changing those entity identities. The missing work is an honest source-fact and interval-reconciliation model, which should be designed only after representative exports are inspected.

The required sequence remains:

`SOURCE FACT → NORMALIZE → DEDUPLICATE → ATTRIBUTE → ANALYZE`

