# RMEDIA / MindBunker — Operational Invariants

Durable rules only. This document is short by design — if a rule needs a paragraph of justification every time it's cited, it belongs in a round report, not here. Updated 2026-08-23 (Sprint 1.2 Native Intelligence Audit). Add to this file only when a rule is strong enough to bind a future round without re-litigating it.

---

**RULE: At most one `work_sessions` row may be open (`ended_at IS NULL`) at any time, globally.**
WHY: intentional work time is a single-threaded human activity, not a set of parallel streams.
SOURCE/EVIDENCE: `work_sessions_one_open_idx`, a database-level partial unique index — not an application check. Verified structurally impossible to violate even under real concurrent multi-device use (Aug 23, 2026 dogfooding: Mac Mini / MacBook Air / iPhone simultaneously open).
CONSEQUENCE: never add a "per-device" or "per-video" open-session allowance. If parallel declared work streams are ever wanted, that is a new invariant requiring a deliberate decision, not a quiet relaxation of this one.

**RULE: A Work Session is a declaration of human intent, never an inference from machine or device state.**
WHY: the device displaying the timer is not necessarily the device performing the work (directly observed: Upwork tracked one device while MindBunker's timer ran on another).
SOURCE/EVIDENCE: Sprint 1.2.1 dogfooding evidence; `docs/architecture/WORK_SESSION_LEDGER_P1.md` §2, §9.
CONSEQUENCE: no future Activity Sensor, browser extension, or OS-level observer may write directly into `work_sessions`. It may only produce a separate, correlated observation stream.

**RULE: Historical reconstructed evidence (`hist_*`) never writes to, and is never queried jointly with, native tables (`clients`, `projects`, `video_logs`, `work_sessions`, `crm_events`, `transactions`).**
WHY: reconstructed evidence and native observation are different truth tiers with different confidence, provenance, and failure modes; merging them silently launders that difference away.
SOURCE/EVIDENCE: `ARTIFACT_CONTRACT.md`'s three-tier model; verified structurally by a standing test ("Historical module code never references work_sessions") and by direct code search each audit round.
CONSEQUENCE: any future feature that appears to need both (e.g., "compare 2024 reconstructed hours to 2026 native hours") must query both sources separately and label them separately in the UI — never sum, average, or silently pick one over the other.

**RULE: Absence of historical source data is UNKNOWN, never zero.**
WHY: a month with no Upwork/Clockify/ActivityWatch row is a gap in the record, not evidence that no work happened.
SOURCE/EVIDENCE: `hist_source_coverage.status` (`DATA_PRESENT` / `UNKNOWN_NO_SOURCE_DATA`); `getAllHistorySummary()` returns `[]`, never a zeroed row, when no batch is imported.
CONSEQUENCE: never default a missing historical value to 0 in a chart, sum, or average without an explicit "unknown" visual distinction.

**RULE: A completed Work Session may be corrected, but never silently.**
WHY: operational history must remain trustworthy without pretending it was perfect on first entry — humans mistime session starts and stops.
SOURCE/EVIDENCE: `correctWorkSession()`, closed-sessions-only by SQL guard; every changed field logs a `crm_events` row (`type: "work_session.corrected"`). Validated against a real case: a 3-minute Upwork/MindBunker start-time gap on Aug 23, 2026.
CONSEQUENCE: never add a code path that edits a closed session's data without producing an audit trail entry; never allow editing of the currently open session through this mechanism.

**RULE: A client-rendered panel showing live, server-owned state must actively re-sync with the server — `useState(initialState)` alone is not enough once more than one device can change that state.**
WHY: React's `useState` reads its initializer only once; `revalidatePath()` only affects the *next* server request, not an already-open tab on another device. Confirmed as the root cause of a real multi-device staleness defect.
SOURCE/EVIDENCE: `docs/SPRINT_1_2_NATIVE_INTELLIGENCE_AUDIT.md` §4, §9, §17; fixed in `WorkSessionPanel.tsx` via a render-time prop sync plus a scoped 20-second `router.refresh()` poll.
CONSEQUENCE: any future panel with the same shape (live mutable state, multiple devices, no realtime channel) should follow the same pattern rather than reinventing — or worse, silently trusting first-load state indefinitely.

**RULE: An unbounded, human-generated read list (notes, history, events) must have a visible default limit with an explicit way to see more.**
WHY: low-friction capture and comfortable long-term retrieval are different UX problems; an ever-growing inline list eventually crowds out the page it lives on.
SOURCE/EVIDENCE: Video Memory's note list, observed distorting the video page in real production use; fixed via a 5-entry default collapse with no change to the underlying (still-unbounded) data fetch.
CONSEQUENCE: apply the same default-collapsed pattern to any future similar surface (a Session Narrative view, a future events timeline) from the start, rather than waiting for it to become a problem first.

**RULE: A metric's name must describe what it actually computes, especially when a placeholder exists for a future real signal.**
WHY: a metric named for input (effort, time, focus) that actually measures output (results delivered) invites a future silent conflation of the two — exactly the "OUTPUT != INPUT" failure the product's own principles warn against.
SOURCE/EVIDENCE: `LeverageScore.breakdown.deepWorkBonus`, currently `videos_this_month * 2` with an explicit "placeholder (ActivityWatch integration future)" comment — not yet wired to any time-based data, but named as if it already were.
CONSEQUENCE: before any metric like this is wired to real `work_sessions` or sensor data, rename it to match what it computes, or split it into two honestly-named metrics.

**RULE: New passive capture (Activity Sensor, Apple Watch, browser extension, or similar) is designed before it is built, and built only when a demonstrated bottleneck justifies it — never merely because it is technically possible.**
WHY: repeated across two rounds' briefs as an explicit, non-negotiable sequencing constraint.
SOURCE/EVIDENCE: "não peça o desktop tracker ainda... primeiro fazemos o ledger parar de mentir por omissão" (Emmanuel, Sprint 1.2.1); this round's own explicit "do not implement Apple-specific integration" instruction.
CONSEQUENCE: a future round proposing passive capture must show current friction data, not just a plausible future convenience, before writing collection code — and must design the privacy boundary (redaction, allowlists, retention) before the first line of capture code, not after.
