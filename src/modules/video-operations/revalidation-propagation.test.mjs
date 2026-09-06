// P1 POST-AUDIT FIX (DR-3) -- structural regression guard.
//
// recordDetailedRevision (this module) and changeRevisionCount
// (productivity/actions.ts) both mutate the same revisions +
// videoLogs.revisionsCount domain, but only changeRevisionCount
// revalidated the full downstream surface (revalidateProductivityViews:
// /, /projects, /productivity, /war-room, /client/dashboard,
// /crm/[clientId]). recordDetailedRevision only ever called this
// module's own narrower revalidateVideoOperations. Fixed by having
// recordDetailedRevision additionally reuse the SAME shared
// revalidateProductivityViews primitive changeRevisionCount already
// uses, instead of duplicating a second route list.
//
// Source-level check, matching this codebase's established convention
// for exactly this situation (see equipment/boundary.test.mjs,
// work-sessions/revalidation-propagation.test.mjs,
// sensor/revalidation-propagation.test.mjs): both functions need a real
// Cloudflare Workers request context (getAuthenticatedDb()) this test
// runner doesn't have, so there is no pure return value to assert a
// fixed surface list against -- what this guards against is a future
// edit silently dropping one of the two calls.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

function readSource(...segments) {
  return readFileSync(path.join(dir, ...segments), "utf8");
}

function sliceFunction(source, exportSignature) {
  const start = source.indexOf(exportSignature);
  assert.ok(start >= 0, `expected to find "${exportSignature}"`);
  const next = source.indexOf("\nexport ", start + exportSignature.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

test("recordDetailedRevision reuses the shared revalidateProductivityViews primitive changeRevisionCount already uses", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "export async function recordDetailedRevision(");
  assert.match(
    fn,
    /revalidateProductivityViews\(video\.clientId\)/u,
    "recordDetailedRevision must revalidate the same broader surface changeRevisionCount does, via the same shared helper",
  );
  // Its own pre-existing video-operations-module surface must still be
  // revalidated too -- this fix adds parity, it does not remove coverage.
  assert.match(fn, /revalidateVideoOperations\(input\.videoId\)/u);
});

test("video-operations/actions.ts imports revalidateProductivityViews from productivity/revalidation, not a local reimplementation", () => {
  const source = readSource("actions.ts");
  assert.match(
    source,
    /import \{ revalidateProductivityViews \} from "@\/modules\/productivity\/revalidation"/u,
  );
});

test("changeRevisionCount (the other DR-3 mutation path) still revalidates via revalidateProductivityViews", () => {
  const source = readFileSync(
    path.join(dir, "..", "productivity", "actions.ts"),
    "utf8",
  );
  const fn = sliceFunction(source, "export async function changeRevisionCount(");
  assert.match(fn, /revalidateProductivityViews\(current\[0\]\.clientId\)/u);
});
