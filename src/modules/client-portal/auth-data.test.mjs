// P0 ENABLE PORTAL CRASH PATCH (Sep 2026) -- structural regression guard.
//
// DUMMY_PASSWORD_HASH (auth-data.ts) pulls in "@/db" -> getCloudflareContext
// -> @opennextjs/cloudflare, so this file is not imported directly here --
// matching this codebase's own convention (see equipment/boundary.test.mjs)
// of static/source-level checks for @/-aliased modules rather than a real
// import through a plain `node --test` run, which does not resolve the
// "@/*" tsconfig path alias.
//
// What this guards: verifyClientCredentials's timing-safe "unknown
// email"/"wrong password" branch calls verifyPassword(password,
// DUMMY_PASSWORD_HASH). Cloudflare Workers' crypto.subtle.deriveBits
// hard-caps PBKDF2 at 100,000 iterations (confirmed via workerd's own
// NotSupportedError text, not guessed) -- this constant was pinned at
// 310000 (matching the old, too-high PASSWORD_HASH_ITERATIONS default in
// auth-core.ts, the proven root cause of the live "Enable portal login"
// crash) and would have thrown that same error on the live Client Worker
// on every unknown-email or wrong-password /client/login attempt, the
// moment AUTH_SESSION_SECRET stopped being empty. Fixed alongside
// PASSWORD_HASH_ITERATIONS in this same round; this test keeps the two
// from drifting apart again.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dir, "auth-data.ts"), "utf8");

test("DUMMY_PASSWORD_HASH is a syntactically valid pbkdf2-sha256 hash", () => {
  const match = source.match(
    /const DUMMY_PASSWORD_HASH =\s*\n?\s*"([^"]+)"/u,
  );
  assert.ok(match, "expected to find the DUMMY_PASSWORD_HASH string literal");
  const parts = match[1].split("$");
  assert.equal(parts.length, 4, "expected version$iterations$salt$hash");
  const [version] = parts;
  assert.equal(version, "pbkdf2-sha256");
});

test("DUMMY_PASSWORD_HASH never exceeds Cloudflare Workers' 100,000-iteration PBKDF2 cap", () => {
  const match = source.match(
    /const DUMMY_PASSWORD_HASH =\s*\n?\s*"([^"]+)"/u,
  );
  assert.ok(match, "expected to find the DUMMY_PASSWORD_HASH string literal");
  const [, iterations] = match[1].split("$");
  assert.ok(
    Number(iterations) <= 100_000,
    `DUMMY_PASSWORD_HASH used ${iterations} iterations, which exceeds Cloudflare Workers' 100,000 PBKDF2 cap and will throw NotSupportedError on every rejected /client/login attempt in production`,
  );
});
