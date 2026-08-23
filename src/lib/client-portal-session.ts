import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import {
  APP_BASE_PATH,
  CLIENT_AUTH_COOKIE_NAME,
  CLIENT_SESSION_MAX_AGE_SECONDS,
  createClientSessionToken,
  createLoginFingerprint,
  verifyClientSessionToken,
} from "@/lib/auth-core";
import { eq } from "drizzle-orm";

// Client Portal Identity session/rate-limit plumbing (Sprint 1.2.2).
//
// Deliberately mirrors src/lib/auth-server.ts's shape (getAuthRuntime /
// getLoginGate / recordLoginFailure / clearLoginFailures / createAuthSession
// / deleteAuthSession) rather than inventing a different pattern -- this is
// the SAME kind of problem (rate-limited password login -> signed session
// cookie) the admin side already solved, just scoped to a clientId instead
// of a single hardcoded operator. It reuses the existing auth_attempts table
// (a bare fingerprint/attempts/window/blocked_until row store, no admin- or
// client-specific columns) with a namespaced fingerprint so both login
// surfaces share one throttling mechanism without a new table, and reuses
// AUTH_SESSION_SECRET rather than provisioning a second secret -- the "cs1"
// version tag baked into every client token already prevents any cross-use
// with admin "v1" tokens even though the signing secret is shared.

type ClientAuthEnv = CloudflareEnv & {
  AUTH_SESSION_SECRET?: string;
};

type AttemptRow = {
  attempts: number;
  window_started: number;
  blocked_until: number | null;
};

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

async function getClientAuthRuntime() {
  const { env } = await getCloudflareContext({ async: true });
  const authEnv = env as ClientAuthEnv;

  if (!authEnv.AUTH_SESSION_SECRET) {
    throw new Error("MindBunker authentication secrets are not configured.");
  }

  return {
    db: authEnv.DB,
    sessionSecret: authEnv.AUTH_SESSION_SECRET,
  };
}

/**
 * Fingerprints on (IP, email) together, not email alone -- this throttles
 * repeated guesses against one client account regardless of source, while
 * not letting one IP's failed attempts against client A lock out a
 * legitimate login attempt for unrelated client B from the same network
 * (e.g. a shared office/coworking IP). Email is lowercased/trimmed before
 * fingerprinting so casing/whitespace can't be used to dodge the limiter.
 */
async function getClientLoginKey(sessionSecret: string, email: string) {
  const requestHeaders = await headers();
  const forwardedIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = requestHeaders.get("cf-connecting-ip") ?? forwardedIp ?? "unknown";
  const normalizedEmail = email.trim().toLowerCase();
  return createLoginFingerprint(`client:${ip}:${normalizedEmail}`, sessionSecret);
}

/**
 * Verifies the session cookie AND that no revocation has happened since it
 * was issued. A signed token alone can only prove "this clientId logged in
 * at some point before expiry" -- it cannot know about a password reset or
 * an operator revoking access that happened afterwards, because nothing
 * about the token itself changes when that happens. So this also reads
 * clients.portalPasswordHash / portalPasswordSetAt: a null hash means
 * access was revoked entirely, and a portalPasswordSetAt newer than this
 * token's issue time means the password was changed/reissued after this
 * session was created -- both invalidate the session immediately rather
 * than waiting out the cookie's normal expiry. This is what makes "revoked
 * capabilities stay revoked" true for the persistent-login path, not just
 * the capability-token path.
 */
export async function isClientAuthenticated(): Promise<number | false> {
  const { sessionSecret } = await getClientAuthRuntime();
  const token = (await cookies()).get(CLIENT_AUTH_COOKIE_NAME)?.value;
  const verified = await verifyClientSessionToken(token, sessionSecret);
  if (!verified) return false;

  const db = await getDb();
  const row = await db
    .select({
      portalPasswordHash: clients.portalPasswordHash,
      portalPasswordSetAt: clients.portalPasswordSetAt,
    })
    .from(clients)
    .where(eq(clients.id, verified.clientId))
    .limit(1);
  const client = row[0];
  if (!client || !client.portalPasswordHash) {
    return false;
  }

  const issuedAtSeconds = verified.expiresAtSeconds - CLIENT_SESSION_MAX_AGE_SECONDS;
  if (
    client.portalPasswordSetAt &&
    Math.floor(client.portalPasswordSetAt.getTime() / 1000) > issuedAtSeconds
  ) {
    return false;
  }

  return verified.clientId;
}

/**
 * Resolves the current client session, redirecting to the portal login if
 * absent. When `expectedClientId` is given, a session authenticated as a
 * DIFFERENT client is also redirected -- this is the server-side guard that
 * makes "Client A can never reach Client B via URL manipulation" true: the
 * clientId in the URL is never itself trusted, it is only ever compared
 * against the clientId that came out of a verified signature.
 */
export async function requireClientAuth(
  loginPath: string,
  expectedClientId?: number,
): Promise<number> {
  const clientId = await isClientAuthenticated();

  if (clientId === false) {
    redirect(loginPath);
  }

  if (expectedClientId !== undefined && clientId !== expectedClientId) {
    redirect(loginPath);
  }

  return clientId;
}

export async function getClientLoginGate(email: string) {
  const { db, sessionSecret } = await getClientAuthRuntime();
  const key = await getClientLoginKey(sessionSecret, email);
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      "SELECT attempts, window_started, blocked_until FROM auth_attempts WHERE fingerprint = ?1",
    )
    .bind(key)
    .first<AttemptRow>();

  return {
    allowed: !row?.blocked_until || row.blocked_until <= now,
    db,
    key,
    now,
    row,
  };
}

export async function recordClientLoginFailure(
  gate: Awaited<ReturnType<typeof getClientLoginGate>>,
) {
  const previous = gate.row;
  let attempts = 1;
  let windowStarted = gate.now;

  if (previous && gate.now - previous.window_started < WINDOW_SECONDS) {
    attempts = previous.attempts + 1;
    windowStarted = previous.window_started;
  }
  const blockedUntil =
    attempts >= MAX_ATTEMPTS ? gate.now + WINDOW_SECONDS : null;

  await gate.db
    .prepare(
      `INSERT INTO auth_attempts (fingerprint, attempts, window_started, blocked_until)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(fingerprint) DO UPDATE SET
         attempts = excluded.attempts,
         window_started = excluded.window_started,
         blocked_until = excluded.blocked_until`,
    )
    .bind(gate.key, attempts, windowStarted, blockedUntil)
    .run();
}

export async function clearClientLoginFailures(
  gate: Awaited<ReturnType<typeof getClientLoginGate>>,
) {
  await gate.db
    .prepare("DELETE FROM auth_attempts WHERE fingerprint = ?1")
    .bind(gate.key)
    .run();
}

export async function createClientAuthSession(clientId: number) {
  const { sessionSecret } = await getClientAuthRuntime();
  const token = await createClientSessionToken(clientId, sessionSecret);
  const cookieStore = await cookies();

  cookieStore.set(CLIENT_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: APP_BASE_PATH,
    maxAge: CLIENT_SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export async function deleteClientAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: APP_BASE_PATH,
    maxAge: 0,
  });
}
