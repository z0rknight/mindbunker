# Historical Reference Artifact — Contract (v0.1.0)

This document describes the machine-readable files under
`reports/reference/` well enough for a future round (human or Codex) to
evaluate whether and how to import them into MindBunker. **No MindBunker
implementation exists yet** — this is the contract for one, not the thing
itself.

## The three-tier distinction this artifact is designed to preserve

Any future integration must keep these three categories separate and never
silently collapse one into another:

1. **Historical reconstructed evidence** (what this artifact contains). A
   value derived from a RAW export by a documented, re-runnable procedure,
   carrying its own confidence and provenance. It is *evidence about the
   past*, produced by inference/aggregation over incomplete sources — never
   a first-class observation MindBunker itself made.
2. **Manually backfilled canonical objects** (not produced here). If a
   future round decides to hand-create real MindBunker objects (e.g. an
   actual `clients` row for Sean Go, a manually entered historical
   `work_sessions` row someone typed in after reviewing this report), those
   are canonical MindBunker data entered by a human, not derived from RAW —
   a categorically different kind of trust than tier 1.
3. **Native MindBunker observations** (not produced here). Data MindBunker
   itself generated in the normal course of its own operation — real
   `work_sessions`, real calendar events, real invoices. This artifact must
   never be mistaken for this tier, and nothing in it should be written
   directly into MindBunker's native tables.

Every record in this artifact is tier 1, and every record says so
(`"canonical"` and `"confidence"` fields — see below). A future importer's
job is to decide, file by file and record by record, whether and how a
tier-1 fact becomes a tier-2 object — this artifact does not make that
decision for you, and nothing here writes to MindBunker.

## Files

### `manifest_v0.json`
Top-level index: contract version, generation date, a one-line description
per file below, the RAW file manifest (path + sha256 + byte size for all 5
source files, so a future round can verify RAW has not drifted since this
artifact was generated), and a `warnings` array of hard rules an importer
must not violate (repeated in relevant sections below).

### `historical_facts_v0.json`
The quantitative core: `{"contract_version", "generated_date", "facts": [...]}`.
Each fact is a long-format record:

```json
{
  "period": {"granularity": "month", "year": 2025, "month": 5},
  "identity": null,
  "source": "upwork_weekly_summary",
  "metric": "revenue",
  "value": 2828.33,
  "unit": "usd",
  "confidence": "HIGH",
  "canonical": true,
  "provenance": "raw/upwork/... ; parsed via parse_upwork_weekly.py; validated ...",
  "derivation": {"version": "0.1.0", "generated_date": "2026-08-22", "note": "..."}
}
```

Field semantics:

- `period.granularity`: `"month"`, `"year"`, `"lifetime"` (no date dimension
  exists in the source, e.g. Upwork's lifetime-billings file), or
  `"window"` (an explicit start/end range, used for the AFK interval-merge
  diagnostic).
- `identity`: `null` for aggregate facts not attributable to any single
  client (e.g. total monthly Upwork revenue across all contracts); otherwise
  an object `{"canonical_id", "canonical_label", "identity_type",
  "resolution_status"}` matching a node in `identity_map_v0.json`.
- `source`: which RAW export the value traces to — `upwork_weekly_summary`,
  `upwork_lifetime_billings`, `clockify_detailed_export`, or
  `activitywatch_afk`. No fact mixes two sources' raw values into one
  number (the one apparent exception, `effective_billed_rate`, divides two
  numbers that both come from `upwork_weekly_summary` — never Upwork
  revenue against Clockify or AFK hours).
- `metric` / `value` / `unit`: self-describing; see the metric catalog
  below for the full list and what each means.
- `confidence`: `HIGH`, `MEDIUM`, `LOW`, `N/A` (the metric is legitimately
  undefined, e.g. a billed rate with zero hours), or `EXPERIMENTAL` (see
  below — always paired with `canonical: false`).
- `canonical`: `true` for every figure meant to be usable as-is; `false` for
  the two categories of number that exist only for transparency and must
  never be imported or summed as fact — the AFK experimental figures, and
  the Sean Go Clockify-hours *upper bound* (as opposed to its *confident*
  sibling, which is `canonical: true`).
- `provenance`: which RAW file, which script, and what validation was run
  against the source's own totals.
- `derivation`: contract version and generation date this fact was produced
  under, plus a human-readable note of any caveat specific to that fact.

**Metric catalog** (source → metrics it produces):

| Source | Metrics | Granularity |
|---|---|---|
| `upwork_weekly_summary` | `revenue` (usd), `billed_hours` (hours), `effective_billed_rate` (usd_per_hour, `null` when hours=0) | month, year |
| `upwork_lifetime_billings` | `client_lifetime_billed` (usd) | lifetime, per client identity |
| `clockify_detailed_export` | `tracked_hours` (hours, aggregate) | month |
| `clockify_detailed_export` | `tracked_hours_confident` / `tracked_hours_upper_bound` (hours) | lifetime, Sean Go identity only |
| `activitywatch_afk` | `raw_event_count` (events), `days_with_any_event` (days) | month |
| `activitywatch_afk` | `experimental_merged_not_afk_hours` (hours), `experimental_wall_clock_coverage_pct` (percent) | window (2025-11-02 → 2026-08-22), `canonical: false` |

### `identity_map_v0.json`
`{"contract_version", "generated_date", "identities": [...]}`. Each node:

```json
{
  "canonical_id": "client:sean_go",
  "canonical_label": "Sean Go",
  "identity_type": "client",
  "resolution_status": "HUMAN_CONFIRMED",
  "resolution_date": "2026-08-22",
  "resolution_note": "...",
  "source_labels": [{"source": "...", "label": "..."}]
}
```

`resolution_status` values and what each licenses an importer to do:

- **`HUMAN_CONFIRMED`** — a person explicitly confirmed this cross-source
  identity link. Currently exactly one: `client:sean_go`. This is the only
  status a future round should treat as safe to promote directly into a
  tier-2 canonical object without re-confirming.
- **`SINGLE_SOURCE_ONLY`** — the label/name appears in exactly one source
  with no cross-source signal at all (24 other Upwork clients; most
  Clockify labels). Safe to import as a single-source fact; unsafe to
  assume it corresponds to anything else without new evidence.
- **`INTERNAL`** — a Clockify label flagged as internal/non-client work
  (contains "EU MESMO", "INTERNO", or "CANAIS INTERNOS"). Should not be
  imported as a client at all.
- **`NOT_AN_IDENTITY`** — a label-extraction artifact (`+1`, `00:00:00`),
  never a real project/client string. Recorded only so it is never later
  mistaken for one.

No `CANDIDATE` nodes exist in this version — the one candidate identified
in the prior round (Sean ↔ Sean Go) was promoted to `HUMAN_CONFIRMED` this
round per explicit user confirmation, and no other candidate survived the
cross-check.

### `source_coverage_v0.json`
`{"contract_version", "generated_date", "window", "sources", "months": [...]}`.
One entry per calendar month, Jan 2023–Aug 2026, each source flagged
`"DATA PRESENT"` or `"UNKNOWN / NO SOURCE DATA"` (see
`COVERAGE_MATRIX_V0.md` for the asymmetric-treatment rationale — Upwork's
declared complete range earns confirmed-zero months; Clockify and AFK do
not). This file answers "can I trust silence from this source for this
month" — it does not carry values, only status + the value already present
in the paired `historical_facts_v0.json` records for months marked present.

## Hard rules for any future importer (also listed in `manifest_v0.json.warnings`)

1. Never write an `activitywatch_afk` fact with `canonical: false` or
   `confidence: "EXPERIMENTAL"` into anything resembling worked hours,
   active hours, or a MindBunker `work_sessions` row.
2. Never sum or average `client:sean_go`'s `tracked_hours_upper_bound` with
   `tracked_hours_confident` — they are alternative interpretations of the
   same 73 days, not additive quantities.
3. Never construct a cross-source rate (e.g. Upwork revenue ÷ Clockify
   hours, or anything ÷ AFK hours). `effective_billed_rate` is
   Upwork-internal only.
4. Never treat a `source_coverage_v0.json` month marked `"UNKNOWN / NO
   SOURCE DATA"` as if its value were zero.
5. Never model any fact here as a MindBunker `work_sessions` row directly
   — these are historical reconstructed evidence (tier 1); a
   `work_sessions`-shaped object would be tier 2 or 3, and creating one is
   an explicit future decision, not an automatic consequence of this
   artifact existing.

## What this artifact deliberately does NOT do

- It does not define a MindBunker schema, migration, or import script.
- It does not decide which facts are "good enough" to promote to tier 2 —
  that judgment call belongs to whoever runs the future import round, with
  full visibility into which facts are HIGH/MEDIUM/LOW/EXPERIMENTAL.
- It does not merge Upwork, Clockify, and ActivityWatch into one narrative
  of "what really happened" — each source's facts stand on their own,
  joined only through the identity map where a human or the source data
  itself has actually established a link.

## Versioning

`contract_version` follows semver informally: a breaking change to field
names/meanings bumps the minor version pre-1.0 (0.1.0 → 0.2.0); a new
metric or identity status value that doesn't change existing fields' shape
is a patch (0.1.0 → 0.1.1). No file in this artifact should ever be
consumed by an importer that doesn't check `contract_version` first.

## Known data-quality correction carried into this round

The prior round's `PROFILING_INVENTORY_V0.md` stated the Upwork
lifetime-billings file has "26 rows" — re-verified this round via
`csv.DictReader` (the authoritative count, since the file has no trailing
newline and naive `wc -l` undercounts by one): it is **25 data rows**. This
artifact uses 25 throughout; the earlier document's "26" was an off-by-one
miscount, noted here rather than silently changed.
