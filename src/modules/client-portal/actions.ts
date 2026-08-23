"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents } from "@/db/schema";
import { createPasswordHash } from "@/lib/auth-core";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isPortalPasswordCandidate, normalizePortalEmail } from "./auth";

// Operator-side Client Portal Identity management (Sprint 1.2.2). These are
// admin-authenticated actions (getAuthenticatedDb -- requires the mb_session
// admin cookie), invoked from the client's CRM detail page. Setting up
// portal access for a client is an operator action, not client self-serve
// signup: this is a small, white-glove business, and every client here was
// already onboarded by Emmanuel personally.

type PortalAccessResult =
  | { success: true; message: string; temporaryPassword?: string }
  | { success: false; error: string };

/**
 * Issues (or replaces) a client's portal password. Returns the plaintext
 * password ONCE in the result so the operator can hand it to the client
 * out-of-band (no email integration exists in this environment) -- it is
 * never stored or logged anywhere, only the PBKDF2 hash is persisted.
 */
export async function setClientPortalPassword(
  clientId: number,
  password: string,
): Promise<PortalAccessResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid client." };
  }
  if (!isPortalPasswordCandidate(password)) {
    return { success: false, error: "Password must be 8-200 characters." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: clients.id, email: clients.email })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Client not found." };
  if (!current[0].email) {
    return {
      success: false,
      error: "Add an email for this client before enabling portal access.",
    };
  }

  const normalizedEmail = normalizePortalEmail(current[0].email);
  const otherPortalClients = await db
    .select({ id: clients.id, email: clients.email })
    .from(clients)
    .where(
      and(
        ne(clients.id, clientId),
        isNotNull(clients.email),
        isNotNull(clients.portalPasswordHash),
      ),
    );
  const collision = otherPortalClients.some(
    (row) => row.email && normalizePortalEmail(row.email) === normalizedEmail,
  );
  if (collision) {
    return {
      success: false,
      error:
        "Another client already uses this email for portal access. Update one of the two emails first.",
    };
  }

  const passwordHash = await createPasswordHash(password);
  const now = new Date();
  await db
    .update(clients)
    .set({
      portalPasswordHash: passwordHash,
      portalPasswordSetAt: now,
      portalResetTokenHash: null,
      portalResetExpiresAt: null,
    })
    .where(eq(clients.id, clientId));

  await db.insert(crmEvents).values({
    clientId,
    videoId: null,
    type: "client_portal_access_granted",
    actor: "admin",
    description: "Client portal password issued.",
    createdAt: now,
  });

  revalidatePath(`/crm/${clientId}`);
  return {
    success: true,
    message: "Portal password set.",
    temporaryPassword: password,
  };
}

export async function revokeClientPortalPassword(
  clientId: number,
): Promise<PortalAccessResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid client." };
  }

  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!current[0]) return { success: false, error: "Client not found." };

  const now = new Date();
  await db
    .update(clients)
    .set({
      portalPasswordHash: null,
      portalPasswordSetAt: null,
      portalResetTokenHash: null,
      portalResetExpiresAt: null,
    })
    .where(eq(clients.id, clientId));

  await db.insert(crmEvents).values({
    clientId,
    videoId: null,
    type: "client_portal_access_revoked",
    actor: "admin",
    description: "Client portal password revoked.",
    createdAt: now,
  });

  revalidatePath(`/crm/${clientId}`);
  return { success: true, message: "Portal access revoked." };
}
