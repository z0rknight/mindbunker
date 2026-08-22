# Video Analytics Data Gaps

Status: discovery only. Missing data below is not authorization to add fields or migrations.

The canonical analytical unit is `video_logs.id`. Current completed-output semantics remain `status = DONE` only.

| Fact | Current source | Derivable now? | Missing? | Plausible future source | Confidence |
|---|---|---:|---:|---|---|
| Stable video identity | `video_logs.id` | Yes | No | MindBunker | High |
| Video title | `video_logs.title` | Yes, nullable for legacy rows | Partial | Operator / future import mapping | High when present |
| Client | `video_logs.client_id` | Yes, nullable | Partial | Operator attribution | High when present |
| Project | `video_logs.project_id` | Yes, nullable | Partial | Operator attribution | High when present |
| Lifecycle state | `video_logs.status` | Yes | No | MindBunker transitions | High |
| Production started time | `video_logs.started_at` | Yes when lifecycle passed through `IN_PROGRESS` | Partial | MindBunker lifecycle | Medium |
| Completion date | `video_logs.date` for `DONE` transitions | Yes for current workflow | Partial for legacy semantics | MindBunker lifecycle | Medium-high |
| Final video duration | None | No | Yes | Media metadata or operator input | Unknown |
| Raw footage duration | None | No | Yes | Media metadata, NLE export, or operator input | Unknown |
| Content type | No video-level field; opportunity `service_interest` is not a reliable substitute | No | Yes | Operator/video metadata or import | Unknown |
| Platform / destination | None | No | Yes | Operator/video metadata or publishing source | Unknown |
| Long-form vs short-form | Not represented canonically | No | Yes | Content type or duration policy decided later | Unknown |
| Revision count | Mutable `video_logs.revisions_count` | Yes as current count | Partial | MindBunker | Medium |
| Revision history, reason, and timing | None | No | Yes | Future revision events/history | Unknown |
| Project deadline | `projects.deadline` | Yes at project level | No for project analysis; not video-specific | MindBunker | High |
| Revenue by client | `clients.total_revenue` aggregate | Partially | Yes for auditable allocation | Finance/payment records | Low-medium |
| Revenue by project | None | No | Yes | Future offer/payment allocation | Unknown |
| Revenue by video | None | No | Yes | Explicit allocation policy | Unknown |
| Active editing time | None | No | Yes | Future normalized work sessions | Unknown |
| Calendar elapsed cycle time | `created_at`, `started_at`, `updated_at`, lifecycle events | Partially | Partial | MindBunker audit history | Medium |
| Editing minutes per final minute | Neither active editing time nor final duration exists | No | Yes | Work sessions + media duration | Unknown |
| Raw footage minutes per final minute | Neither duration exists | No | Yes | Media metadata | Unknown |
| Revision cost | Revision count exists; time/revenue per revision does not | No | Yes | Revision history + work sessions + allocation | Unknown |
| Effective revenue/hour | Revenue and active time are not attributable to the same unit | No | Yes | Payments + normalized work sessions | Unknown |
| Human energy cost | Daily `health_logs` can be correlated by date only | Weakly, at daily aggregate | Yes for video attribution | Operator check-in; never passive inference alone | Low |
| Delegation suitability | No canonical fact | No | Yes | Later operator judgment using real cost/quality data | Unknown |

## What is already safe to analyze

- Counts and lifecycle inventory by client and project.
- Completed output using `status = DONE` only.
- Current revision-count drag for completed videos, with the limitation that it is mutable rather than historical.
- Project progress derived from video lifecycle states.
- Basic lifecycle elapsed-time observations where timestamps/events exist.

## What must not be presented as truth yet

- Revenue per video or project by dividing unrelated aggregates.
- Active editing time inferred from elapsed calendar time.
- Revision cost inferred from revision count alone.
- Long-form/short-form classification inferred from title text.
- Energy impact attributed to a specific video from a daily health log.
- Additive time totals from overlapping telemetry sources.

## Readiness conclusion

MindBunker already has the stable video identity and Client → Project → Video attribution spine required for later analysis. The critical missing facts are media durations, content classification, attributable revenue, normalized active work time, and revision history. None is required for the first-class Projects surface, so this round adds no analytics schema.

