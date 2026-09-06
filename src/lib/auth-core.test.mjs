import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_CLIENT_PORTAL_LOGIN_URL,
  createClientSessionToken,
  createPasswordHash,
  createSessionToken,
  verifyClientSessionToken,
  verifyPassword,
  verifySessionToken,
} from "./auth-core.ts";

// Client Portal Identity authorization tests (Sprint 1.2.2, Phase 3).
//
// These cover the signed-token layer only -- the part of client
// authentication that's pure enough to unit test without a Next.js request
// context (cookies()/headers()) or a database. isClientAuthenticated,
// requireClientAuth, and the login-rate-limit gate in
// client-portal-session.ts are exercised structurally by inspection since
// they depend on next/headers and D1, matching this codebase's existing
// convention of not unit-testing the auth-server.ts equivalents either.

const SECRET = "test-secret-do-not-use-in-real-env";

test("a valid client session token verifies to the correct clientId", async () => {
  const token = await createClientSessionToken(42, SECRET, 1_000_000);
  const verified = await verifyClientSessionToken(token, SECRET, 1_000_000);
  assert.notEqual(verified, false);
  assert.equal(verified.clientId, 42);
});

test("client session token rejects a wrong signing secret", async () => {
  const token = await createClientSessionToken(42, SECRET, 1_000_000);
  const verified = await verifyClientSessionToken(token, "a-different-secret", 1_000_000);
  assert.equal(verified, false);
});

test("client session token rejects after expiry", async () => {
  const token = await createClientSessionToken(42, SECRET, 1_000_000);
  const farFuture = 1_000_000 + 31 * 24 * 60 * 60 * 1_000; // 31 days later
  const verified = await verifyClientSessionToken(token, SECRET, farFuture);
  assert.equal(verified, false);
});

test("client session token rejects a tampered clientId even with a valid-looking shape", async () => {
  const token = await createClientSessionToken(42, SECRET, 1_000_000);
  const [version, , expiresAt, nonce, signature] = token.split(".");
  // Attempt to widen scope from clientId 42 to clientId 99 by editing the
  // payload directly -- this must fail, because the signature covers the
  // clientId itself. If this ever passed, "no user-controlled client_id
  // trusted for authorization" would be broken.
  const forged = `${version}.99.${expiresAt}.${nonce}.${signature}`;
  const verified = await verifyClientSessionToken(forged, SECRET, 1_000_000);
  assert.equal(verified, false);
});

test("client session tokens and admin session tokens can never cross-verify", async () => {
  const clientToken = await createClientSessionToken(1, SECRET, 1_000_000);
  const adminToken = await createSessionToken(SECRET, 1_000_000);

  // An admin token must never be accepted as a client session, even though
  // both are signed with the same secret and even though the admin token
  // technically contains no clientId at all -- the version tag alone must
  // be enough to refuse it.
  const clientVerifyingAdminToken = await verifyClientSessionToken(
    adminToken,
    SECRET,
    1_000_000,
  );
  assert.equal(clientVerifyingAdminToken, false);

  // And a client token must never be accepted as an admin session.
  const adminVerifyingClientToken = await verifySessionToken(
    clientToken,
    SECRET,
    1_000_000,
  );
  assert.equal(adminVerifyingClientToken, false);
});

test("malformed/missing client session tokens are rejected, not thrown", async () => {
  assert.equal(await verifyClientSessionToken(undefined, SECRET), false);
  assert.equal(await verifyClientSessionToken("", SECRET), false);
  assert.equal(await verifyClientSessionToken("not-a-real-token", SECRET), false);
  assert.equal(await verifyClientSessionToken("cs1.42.abc.nonce.sig", SECRET), false);
  assert.equal(await verifyClientSessionToken("cs1.-5.9999999999.nonce.sig", SECRET), false);
});

test("two client session tokens for the same clientId are never identical (nonce)", async () => {
  const first = await createClientSessionToken(7, SECRET, 1_000_000);
  const second = await createClientSessionToken(7, SECRET, 1_000_000);
  assert.notEqual(first, second);
});

// CRM CONTROL PLANE MIGRATION (Sep 2026) -----------------------------------
//
// The canonical login URL constant itself: must point at the public
// Client Worker's route, never the legacy /mindbunker/client/[token]
// Vault path (CLIENT_PORTAL_PATH_PREFIX in modules/gateway/config.ts is a
// deliberately separate, untouched mechanism -- this only guards against
// this specific constant regressing back to an operator-scoped URL).
test("canonical client portal login URL points at the public /client route, not /mindbunker", () => {
  assert.equal(CANONICAL_CLIENT_PORTAL_LOGIN_URL, "https://emmanueldarosa.com/client/login");
  assert.equal(CANONICAL_CLIENT_PORTAL_LOGIN_URL.includes("/mindbunker"), false);
});

// createPasswordHash / verifyPassword is the exact primitive
// setClientPortalPassword (CRM "Enable portal login") and
// verifyClientCredentials (public /client/login) share -- this is what
// makes a password the CRM issues actually usable by the autonomous
// login, and this codebase had no direct test of the pair itself before
// this round (only the signed-session-token layer above was covered).
test("verifyPassword accepts the exact password createPasswordHash was given", async () => {
  const hash = await createPasswordHash("a-genuinely-random-portal-password");
  assert.equal(await verifyPassword("a-genuinely-random-portal-password", hash), true);
});

test("verifyPassword rejects a wrong password against a real hash", async () => {
  const hash = await createPasswordHash("a-genuinely-random-portal-password");
  assert.equal(await verifyPassword("not-the-right-password", hash), false);
});

test("verifyPassword rejects an empty password against a real hash", async () => {
  const hash = await createPasswordHash("a-genuinely-random-portal-password");
  assert.equal(await verifyPassword("", hash), false);
});

// P0 ENABLE PORTAL CRASH PATCH (Sep 2026) --------------------------------
//
// Regression guard for the actual root cause of the live "Enable portal
// login" crash: PASSWORD_HASH_ITERATIONS was 310_000 (OWASP's own
// PBKDF2-SHA256 recommendation), which is entirely valid to Node's
// WebCrypto -- so every test above passed the whole time -- but
// Cloudflare Workers' crypto.subtle.deriveBits hard-caps PBKDF2 at
// 100,000 iterations and throws NotSupportedError above that, confirmed
// from workerd's own error text, not guessed. This test can't reproduce
// the Workers-only throw (Node enforces no such cap either), so instead
// it asserts the one fact that actually prevents the regression: the
// iteration count createPasswordHash embeds in every hash it produces
// must never exceed Cloudflare's documented ceiling again.
test("createPasswordHash never exceeds Cloudflare Workers' 100,000-iteration PBKDF2 cap", async () => {
  const hash = await createPasswordHash("a-genuinely-random-portal-password");
  const [, iterations] = hash.split("$");
  assert.ok(
    Number(iterations) <= 100_000,
    `createPasswordHash used ${iterations} iterations, which exceeds Cloudflare Workers' 100,000 PBKDF2 cap and will throw NotSupportedError in production`,
  );
});
