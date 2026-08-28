// Pre-Operation Reality Hardening — ActivityWatch Import round.
// Small tunables kept separate from core.ts (pure logic) and actions.ts
// (D1/R2 glue) so they're easy to find and adjust without touching either.

// R2 staging prefix for raw uploaded export files. These are NOT the
// historical record -- activitywatch_events rows are. This is scratch
// input the confirm step reads from; nothing else in the app reads it.
export const ACTIVITYWATCH_R2_PREFIX = "activitywatch-imports/";

// How many event fingerprints to check for existence in one D1 SELECT
// during the read-only Preview pass (SELECT ... WHERE fingerprint IN (...)).
//
// ACTIVITYWATCH CLI IMPORT round (26 Aug 2026): this was 400 and had never
// been run against a real D1 binding (local or remote) -- Round 7's own
// report flagged CPU/wall-clock time as the unverified risk at scale, not
// this. Building import-cli.ts and actually running its dry-run against a
// real local D1 binding (via getPlatformProxy, the same binding driver
// production D1 uses) surfaced a real bug immediately: a plain
// `WHERE fingerprint IN (...)` with more than 100 bound parameters fails
// outright. Empirically probed against this exact binding: 100 params
// succeeds, 150 fails. D1's documented bound-parameter ceiling is 100 per
// statement. 400 was never safe -- this would have broken
// previewActivityWatchImport (the browser Preview flow) in production the
// first time a file had more than 100 pending not-yet-flushed events, not
// just this new CLI. Fixed here, in the one shared constant both consumers
// already import, with real margin under the empirically-confirmed ceiling.
export const PREVIEW_DEDUPE_CHECK_BATCH_SIZE = 90;

// How many event rows to include in a single multi-row INSERT statement
// during Confirm. activitywatch_events has 9 insertable columns
// (importId, bucketId, bucketType, hostname, startedAt, durationSeconds,
// appName, windowTitle, afkStatus, provenance, fingerprint -- 11 in
// practice), so 8 rows keeps the widest statement comfortably under D1's
// "too many SQL variables" ceiling -- the same reasoning already applied
// to hist_facts (see historical/actions.ts's INSERT_CHUNK_SIZE comment).
export const CONFIRM_INSERT_ROWS_PER_STATEMENT = 8;

// How many INSERT statements to group into one db.batch() network round
// trip during Confirm. Bounds both memory (only this many rows' worth of
// pending work at once) and the number of awaited round trips for very
// large files -- a real trade-off documented in the final report: at true
// ~64MB scale this could still be several hundred batch() calls, and
// whether that completes inside one HTTP request's wall-clock budget on
// Cloudflare Workers is NOT verified from this sandbox (no live deploy
// access). See PRE_OPERATION_REALITY_HARDENING... report's /BOOK-style
// honesty section for the equivalent call on this round's own report.
export const CONFIRM_STATEMENTS_PER_BATCH = 15;

// Only these two bucket families are in scope this round (brief's own
// glob spec). Anything else is rejected at upload time, not guessed at.
export { }; // (bucket prefixes themselves live in core.ts, next to the
            // functions that use them, to keep one source of truth)
