// P1 POST-AUDIT FIX (DR-1) -- structural regression guard.
//
// approveSensorSession writes the same canonical work_sessions fact a
// manual stopWorkSession/stopWorkSessionAt writes, but before this round
// only revalidated its own Sensor admin surfaces -- Dashboard, War Room,
// CRM, and Projects could show stale tracked-time numbers after an
// approval until a hard reload. The fix reuses the existing shared
// revalidateWorkSessionSurfaces(...) helper from work-sessions/actions.ts
// rather than inventing a second, parallel surface list.
//
// Matching this codebase's own established convention for exactly this
// situation (see equipment/boundary.test.mjs and
// work-sessions/revalidation-propagation.test.mjs), this is a
// source-level check: approveSensorSession needs a real Cloudflare
// Workers request context (getAuthenticatedDb()) this test runner
// doesn't have, so there's no pure return value to assert a fixed number
// against -- the regression this guards against is a *removed*
// revalidatePath/revalidateWorkSessionSurfaces call.

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

test("approveSensorSession reuses the shared revalidateWorkSessionSurfaces helper, not a second surface list", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "export async function approveSensorSession(");
  assert.match(
    fn,
    /revalidateWorkSessionSurfaces\(await getVideoAttribution\(/u,
    "approveSensorSession must reuse the same shared helper stopWorkSession/correctWorkSession use for downstream propagation",
  );
  // Its own pre-existing Sensor-specific admin surfaces must still be
  // revalidated too -- this fix adds parity with manual stop/correct, it
  // does not remove Sensor's own surfaces.
  assert.match(fn, /revalidatePath\("\/productivity\/sensor"\)/u);
  assert.match(fn, /revalidatePath\(`\/productivity\/sensor\/sessions\/\$\{id\}`\)/u);
});

test("actions.ts imports revalidateWorkSessionSurfaces and getVideoAttribution from the work-sessions module, not a local reimplementation", () => {
  const source = readSource("actions.ts");
  assert.match(
    source,
    /import \{ getVideoAttribution, revalidateWorkSessionSurfaces \} from "\.\.\/work-sessions\/actions"/u,
  );
});
