// FLOW CLOSURE (Sunday round) -- structural regression guard.
//
// This round's central finding was a canonical-propagation gap: closing a
// Work Session, approving a Quote, and recording a Transaction are each a
// canonical mutation with several real downstream projections (Dashboard,
// War Room, CRM, Projects), but each action only ever told a subset of
// those projections to refresh -- a soft client-side navigation right
// after the mutation could show stale (Next.js Router Cache) data until a
// hard reload.
//
// The fix is exclusively `revalidatePath(...)` calls -- there is no pure
// return value to assert against with a real unit test, and the mutated
// functions all need `getAuthenticatedDb()` (a Cloudflare Workers request
// context this test runner doesn't have). So, matching this codebase's
// own established convention for exactly this situation (see
// equipment/boundary.test.mjs), this is a source-level check: it reads
// the actual action files and asserts the expected revalidatePath calls
// are present in the functions this round touched, so a future edit that
// accidentally drops one of them fails a test instead of silently
// reintroducing the stale-data bug.

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
  // Slice to the next top-level "export" after this point (or EOF), which
  // is a good enough boundary for these straight-line action functions.
  const next = source.indexOf("\nexport ", start + exportSignature.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

test("stopWorkSession revalidates the full downstream surface, not just /productivity", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "export async function stopWorkSession(");
  assert.match(fn, /revalidateWorkSessionSurfaces\(/u);
  assert.doesNotMatch(
    fn,
    /revalidatePath\("\/productivity"\);\s*\n\s*return \{\s*\n\s*success: true,\s*\n\s*message: "Work session stopped\."/u,
    "stopWorkSession regressed back to a bare /productivity-only revalidate",
  );
});

test("stopWorkSessionAt revalidates the full downstream surface, not just /productivity", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "export async function stopWorkSessionAt(");
  assert.match(fn, /revalidateWorkSessionSurfaces\(/u);
});

test("revalidateWorkSessionSurfaces covers Dashboard, War Room, CRM and Projects", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "function revalidateWorkSessionSurfaces(");
  for (const expectedPath of ['"/productivity"', '"/"', '"/war-room"', '"/crm"', '"/projects"']) {
    assert.ok(
      fn.includes(`revalidatePath(${expectedPath})`),
      `expected revalidateWorkSessionSurfaces to call revalidatePath(${expectedPath})`,
    );
  }
});

test("correctWorkSession passes clientId/projectId attribution to the shared revalidator", () => {
  const source = readSource("actions.ts");
  const fn = sliceFunction(source, "export async function correctWorkSession(");
  assert.match(
    fn,
    /revalidateWorkSessionSurfaces\(\{\s*clientId:\s*newClientId,\s*projectId:\s*newProjectId\s*\}\)/u,
  );
});

test("approving a Quote also revalidates the Dashboard (Sales cards + sale banner)", () => {
  const source = readSource("..", "quotes", "actions.ts");
  const fn = sliceFunction(source, "export async function updateQuoteStatus(");
  assert.match(fn, /revalidatePath\("\/"\)/u);
  assert.match(fn, /revalidatePath\(`\/crm\/\$\{quote\.clientId\}`\)/u);
});

test("recording, editing, or deleting a Transaction also revalidates War Room", () => {
  const source = readSource("..", "finance", "actions.ts");
  for (const fnName of ["addTransaction", "deleteTransaction", "updateTransaction"]) {
    const fn = sliceFunction(source, `export async function ${fnName}(`);
    assert.match(
      fn,
      /revalidatePath\("\/war-room"\)/u,
      `expected ${fnName} to revalidate /war-room`,
    );
  }
});
