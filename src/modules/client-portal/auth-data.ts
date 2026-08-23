import "server-only";

import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { createPasswordHash, verifyPassword } from "@/lib/auth-core";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  PORTAL_RESET_TOKEN_TTL_MS,
  createPortalResetToken,
  hashPortalResetToken,
  isPortalPasswordCandidate,
  isPortalResetToken,
  normalizePortalEmail,
} from "./auth";

// Client Portal Identity -- client-facing credential verification and
// self-service password reset (Sprint 1.2.2). Uses getDb() (unauthenticated
// raw D1 access), never getAuthenticatedDb() -- a client visiting these
// entry points has no admin session and must never be required to have
// one. All authorization for what a verified clientId can then see or do
// lives downstream of these functions (client-portal-session.ts's session
// cookie, and the ownership checks in the dashboard/action layer).
//
// clients.email has no DB-level uniqueness constraint (it's free-text CRM
// data, not a signup field) -- so lookups here match in application code
// after fetching only portal-enabled rows, and refuse to authenticate
// against an AMBIGUOUS email (more than one portal-enabled client sharing
// the same normalized address) rather than guessing which one was meant.
// setClientPortalPassword() in actions.ts is the enforcement point that
// keeps this case from arising in the first place; this is defense in
// depth, not the only guard.

export type ClientCredentialMatch = {
  clientId: number;
  clientName: string;
};

// A syntactically valid PBKDF2 hash in the exact format createPasswordHash
// produces, but derived from no real password -- used only to burn the
// same CPU cost as a real verification when there's no account to check
// against, so response time doesn't leak whether an email is registered.
const DUMMY_PASSWORD_HASH =
  "pbkdf2-sha256$310000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function verifyClientCredentials(
  email: string,
  password: string,
): Promise<ClientCredentialMatch | null> {
  if (typeof email !== "string" || typeof password !== "string" || !password) {
    return null;
  }
  const normalizedEmail = normalizePortalEmail(email);
  if (!normalizedEmail) return null;

  const db = await getDb();
  const candidates = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      portalPasswordHash: clients.portalPasswordHash,
    })
    .from(clients)
    .where(and(isNotNull(clients.email), isNotNull(clients.portalPasswordHash)));

  const matches = candidates.filter(
    (row) => row.email && normalizePortalEmail(row.email) === normalizedEmail,
  );
  if (matches.length !== 1) {
    // Zero matches (unknown email) and 2+ matches (ambiguous, should never
    // happen once setClientPortalPassword's invariant is enforced, but
    // checked again here) are both treated as "invalid credentials" --
    // never distinguished in a way a caller could use to enumerate emails.
    // Pay the same PBKDF2 cost a real check would before returning, so
    // response time doesn't leak which branch was taken.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  const [match] = matches;
  if (!match.portalPasswordHash) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }
  const valid = await verifyPassword(password, match.portalPasswordHash);
  if (!valid) return null;

  return { clientId: match.id, clientName: match.name };
}

/**
 * Always returns the same generic shape regardless of whether the email
 * matched a portal-enabled client -- callers must show an identical message
 * either way ("If that email has portal access, we've sent reset
 * instructions") so this endpoint cannot be used to enumerate clients.
 *
 * No email-sending integration exists in this environment. In development,
 * the raw reset token is returned directly (clearly marked) so the flow is
 * testable end-to-end locally, mirroring the existing src/app/qa-login dev
 * shortcut. In production this function stops short of sending anything --
 * see docs/architecture note on this gap; wiring a real email provider is
 * an explicit, separate, production-only follow-up.
 */
export async function requestPortalPasswordReset(
  email: string,
): Promise<{ devToken: string | null }> {
  const normalizedEmail = normalizePortalEmail(String(email ?? ""));
  const result = { devToken: null as string | null };
  if (!normalizedEmail) return result;

  const db = await getDb();
  const candidates = await db
    .select({
      id: clients.id,
      email: clients.email,
      portalPasswordHash: clients.portalPasswordHash,
    })
    .from(clients)
    .where(and(isNotNull(clients.email), isNotNull(clients.portalPasswordHash)));
  const matches = candidates.filter(
    (row) => row.email && normalizePortalEmail(row.email) === normalizedEmail,
  );
  // Ambiguous or unknown -- silently no-op. The generic response is the
  // same either way; see the doc comment above.
  if (matches.length !== 1) return result;

  const token = createPortalResetToken();
  const tokenHash = await hashPortalResetToken(token);
  const expiresAt = new Date(Date.now() + PORTAL_RESET_TOKEN_TTL_MS);

  await db
    .update(clients)
    .set({ portalResetTokenHash: tokenHash, portalResetExpiresAt: expiresAt })
    .where(eq(clients.id, matches[0].id));

  if (process.env.NODE_ENV === "development") {
    result.devToken = token;
  }
  return result;
}

export async function resetPortalPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isPortalResetToken(rawToken)) {
    return { success: false, error: "This reset link is invalid or has expired." };
  }
  if (!isPortalPasswordCandidate(newPassword)) {
    return { success: false, error: "Password must be 8-200 characters." };
  }

  const db = await getDb();
  const tokenHash = await hashPortalResetToken(rawToken);
  const candidates = await db
    .select({
      id: clients.id,
      portalResetTokenHash: clients.portalResetTokenHash,
      portalResetExpiresAt: clients.portalResetExpiresAt,
    })
    .from(clients)
    .where(isNotNull(clients.portalResetTokenHash));

  const match = candidates.find((row) => row.portalResetTokenHash === tokenHash);
  if (
    !match ||
    !match.portalResetExpiresAt ||
    match.portalResetExpiresAt.getTime() <= Date.now()
  ) {
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await createPasswordHash(newPassword);
  await db
    .update(clients)
    .set({
      portalPasswordHash: passwordHash,
      portalPasswordSetAt: new Date(),
      portalResetTokenHash: null,
      portalResetExpiresAt: null,
    })
    .where(eq(clients.id, match.id));

  return { success: true };
}
