import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientSessionToken,
  createSessionToken,
  verifyClientSessionToken,
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
