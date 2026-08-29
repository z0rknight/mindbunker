"use server";

import { getAuthenticatedDb } from "@/db";
import { isActiveExternalClient, isInternalClientName } from "@/lib/client-identity";
import {
  bookings,
  clients,
  crmEvents,
  gatewayInvitations,
  intakeSubmissions,
  projects,
  transactions,
  videoLogs,
  workSessions,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { startOfMonthISO } from "@/utils/date";
import { getLastActiveByClient } from "@/modules/work-sessions/data";
import { BOOK_REQUEST_EVENT_TYPE } from "@/modules/booking/core";
import { QUOTE_REQUEST_EVENT_TYPE } from "@/modules/quote-intake/core";
import { revalidatePath } from "next/cache";
import {
  normalizeInstagramUsername,
  validateInstagramProfileInput,
} from "@/modules/instagram/core";
import {
  getInstagramProvider,
  isInstagramImportConfigured,
} from "@/modules/instagram/provider";
import {
  ACTIVE_SURFACE,
  GELADEIRA,
  clientHasProtectedHistory,
  describeProtectedHistory,
  isPositiveId,
  isValidClientEmail,
  planArchivalTransition,
  validateLogCrmActivityInput,
  type ClientDependencyCounts,
} from "./core";

export async function addClient(data: {
  name: string;
  status?: "lead" | "active" | "inactive";
  email?: string;
  phone?: string;
  notes?: string;
  source?: string;
  instagramUsername?: string;
}) {
  const name = data.name.trim().slice(0, 160);
  if (!name) {
    throw new Error("Contact name is required.");
  }

  const db = await getAuthenticatedDb();
  const status = data.status ?? "lead";
  const instagramUsername = data.instagramUsername
    ? normalizeInstagramUsername(data.instagramUsername)
    : null;
  if (data.instagramUsername && !instagramUsername) {
    throw new Error("Enter a valid Instagram username.");
  }
  const inserted = await db
    .insert(clients)
    .values({
      name,
      status,
      opportunityStage: status === "active" ? "active" : "new",
      email: data.email?.trim().slice(0, 320) || null,
      phone: data.phone?.trim().slice(0, 80) || null,
      instagramUsername,
      notes: data.notes?.trim().slice(0, 5_000) || null,
      source: data.source?.trim().slice(0, 160) || null,
      totalProjects: 0,
      totalRevenue: 0,
      contacted: false,
      converted: false,
    })
    .returning({ id: clients.id });

  if (inserted[0]) {
    await db.insert(crmEvents).values({
      clientId: inserted[0].id,
      type: status === "lead" ? "lead_created" : "client_created",
      actor: "admin",
      description: status === "lead" ? "Lead created" : "Client created",
    });
  }
  revalidatePath("/");
  revalidatePath("/crm");
}

const CLIENT_STATUSES = ["lead", "active", "inactive"] as const;

export async function updateClient(
  id: number,
  data: Partial<{
    name: string;
    status: "lead" | "active" | "inactive";
    email: string;
    phone: string;
    notes: string;
    source: string;
    totalProjects: number;
    totalRevenue: number;
    contacted: boolean;
    converted: boolean;
  }>
) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid contact.");
  }

  // Sprint 3 P2: addClient trims/caps every one of these same fields;
  // updateClient wrote `data` straight into db.update(...).set(...) with
  // no validation at all -- no length caps, no runtime status-enum check
  // (the DB column's type enum isn't an app-level guarantee). Any future
  // caller other than the current hand-written UI (which already applies
  // its own client-side email regex) could otherwise write an
  // unboundedly long note or an invalid status string. Mirrors
  // addClient's exact trim/cap values, not a new set of rules.
  const set: typeof data = { ...data };
  if (set.name !== undefined) {
    const name = set.name.trim().slice(0, 160);
    if (!name) {
      throw new Error("Contact name is required.");
    }
    set.name = name;
  }
  if (set.status !== undefined && !CLIENT_STATUSES.includes(set.status)) {
    throw new Error("Invalid status.");
  }
  // An empty string after trim is treated as "don't touch" (undefined),
  // not "clear the field" -- the same "blank must not silently erase"
  // principle as the bulk-edit safety fix elsewhere in this round.
  // db.update().set() omits an undefined key from the SQL entirely, so
  // this leaves the existing value exactly as it was.
  if (set.email !== undefined) {
    const email = set.email.trim().slice(0, 320);
    if (email && !isValidClientEmail(email)) {
      throw new Error("Enter a valid email address.");
    }
    set.email = email || undefined;
  }
  if (set.phone !== undefined) {
    set.phone = set.phone.trim().slice(0, 80) || undefined;
  }
  if (set.notes !== undefined) {
    set.notes = set.notes.trim().slice(0, 5_000) || undefined;
  }
  if (set.source !== undefined) {
    set.source = set.source.trim().slice(0, 160) || undefined;
  }

  const db = await getAuthenticatedDb();
  await db.update(clients).set(set).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

export async function convertLeadToClient(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid contact.");
  }
  const db = await getAuthenticatedDb();
  await db
    .update(clients)
    .set({
      status: "active",
      opportunityStage: "active",
      converted: true,
      contacted: true,
    })
    .where(eq(clients.id, id));
  await db.insert(crmEvents).values({
    clientId: id,
    type: "client_activated",
    actor: "admin",
    description: "Lead converted to active client",
  });
  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
}

// ─── GELADEIRA (Sprint 1.2 P0) ─────────────────────────────────────────────────
//
// Reversible operational archival/visibility state. Orthogonal to
// status/opportunityStage/converted/contacted — neither archiveClient()
// nor reactivateClient() ever touches those fields, any child row, any
// Gateway/Vault capability, or any historical data. See
// docs/architecture/GELADEIRA_DOMAIN_PROTOTYPE.md for the domain model.

type ArchivalActionResult =
  | { success: true; message: string; changed: boolean }
  | { success: false; error: string };

export async function archiveClient(id: number): Promise<ArchivalActionResult> {
  if (!isPositiveId(id)) {
    return { success: false, error: "Invalid contact." };
  }
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ archivalState: clients.archivalState })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!current[0]) {
    return { success: false, error: "Contact not found." };
  }

  const plan = planArchivalTransition(current[0].archivalState, GELADEIRA);
  if (!plan.changed) {
    return { success: true, message: "Already in Geladeira.", changed: false };
  }

  const now = new Date();
  await db.batch([
    db
      .update(clients)
      .set({ archivalState: GELADEIRA, archivedAt: now })
      .where(eq(clients.id, id)),
    db.insert(crmEvents).values({
      clientId: id,
      type: "client_archived",
      actor: "admin",
      description: "Moved to Geladeira",
      createdAt: now,
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  revalidatePath("/projects");
  revalidatePath("/productivity");
  return { success: true, message: "Moved to Geladeira.", changed: true };
}

export async function reactivateClient(
  id: number,
): Promise<ArchivalActionResult> {
  if (!isPositiveId(id)) {
    return { success: false, error: "Invalid contact." };
  }
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ archivalState: clients.archivalState })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!current[0]) {
    return { success: false, error: "Contact not found." };
  }

  const plan = planArchivalTransition(current[0].archivalState, ACTIVE_SURFACE);
  if (!plan.changed) {
    return { success: true, message: "Already active.", changed: false };
  }

  const now = new Date();
  await db.batch([
    db
      .update(clients)
      .set({ archivalState: ACTIVE_SURFACE, archivedAt: null })
      .where(eq(clients.id, id)),
    db.insert(crmEvents).values({
      clientId: id,
      type: "client_reactivated",
      actor: "admin",
      description: "Reactivated from Geladeira",
      createdAt: now,
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  revalidatePath("/projects");
  revalidatePath("/productivity");
  return { success: true, message: "Reactivated.", changed: true };
}

const CREATION_EVENT_TYPES = ["lead_created", "client_created"] as const;

async function getClientDependencyCounts(
  db: Awaited<ReturnType<typeof getAuthenticatedDb>>,
  clientId: number,
): Promise<ClientDependencyCounts> {
  const [
    projectRows,
    bookingRows,
    invitationRows,
    intakeRows,
    videoRows,
    eventRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.clientId, clientId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.clientId, clientId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(gatewayInvitations)
      .where(eq(gatewayInvitations.clientId, clientId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.clientId, clientId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(videoLogs)
      .where(eq(videoLogs.clientId, clientId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(crmEvents)
      .where(
        and(
          eq(crmEvents.clientId, clientId),
          notInArray(crmEvents.type, [...CREATION_EVENT_TYPES]),
        ),
      ),
  ]);

  return {
    projects: Number(projectRows[0]?.count ?? 0),
    bookings: Number(bookingRows[0]?.count ?? 0),
    gatewayInvitations: Number(invitationRows[0]?.count ?? 0),
    intakeSubmissions: Number(intakeRows[0]?.count ?? 0),
    videos: Number(videoRows[0]?.count ?? 0),
    nonCreationEvents: Number(eventRows[0]?.count ?? 0),
  };
}

// ─── DELETE (permanent) ────────────────────────────────────────────────────────
//
// Geladeira P0 safety fix (canonical map P0): permanent deletion used to be
// an unguarded cascade with no dependency check and no logging. It now
// fails closed — any Client with real accumulated history is refused, with
// Geladeira surfaced as the correct alternative. Only a genuinely empty
// Client (no Projects, Videos, Bookings, Gateway activity, or CRM history
// beyond its own creation event) can still be deleted this way.

type DeleteClientResult =
  | { success: true; message: string }
  | { success: false; error: string; protectedCounts?: ClientDependencyCounts };

export async function deleteClient(id: number): Promise<DeleteClientResult> {
  if (!isPositiveId(id)) {
    return { success: false, error: "Invalid contact." };
  }
  const db = await getAuthenticatedDb();
  const current = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!current[0]) {
    return { success: false, error: "Contact not found." };
  }

  const counts = await getClientDependencyCounts(db, id);
  if (clientHasProtectedHistory(counts)) {
    return {
      success: false,
      error: `"${current[0].name}" has real history (${describeProtectedHistory(counts)}) and can't be permanently deleted. Move it to Geladeira instead to keep it out of your active surfaces without losing anything.`,
      protectedCounts: counts,
    };
  }

  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/");
  revalidatePath("/crm");
  return { success: true, message: "Contact deleted." };
}

export async function getCRMSummary() {
  const db = await getAuthenticatedDb();
  const monthStart = startOfMonthISO();
  const allClients = await db.select().from(clients);

  // "Active surface" scoping (Geladeira P0): these three numbers back the
  // CRM page's operational headings, so each excludes Geladeira clients.
  // `totalClients` below is deliberately left as-is — see its own comment.
  // Quick Morning Reality Patch §6: RMEDIA's own internal record is a
  // real `clients` row (it needs one to log internal Operations/
  // Marketing/Administration/Product work against), but it is not a real
  // client relationship -- it must never inflate "Active Clients" style
  // counts. Presentation-only exclusion, name-based (see client-identity.ts);
  // no schema change, RMEDIA's row and its data are untouched.
  const activeClients = allClients.filter(isActiveExternalClient);
  // Ambiguous-counter note (documented, not silently redefined, per the
  // Geladeira prototype's counter-semantics section): "leads this month" is
  // a lead-generation activity metric ("created this month"), not a
  // current-standing metric — a lead archived the same month it was
  // created still happened this month. Left unfiltered on purpose.
  const leadsThisMonth = allClients.filter(
    (c) =>
      c.status === "lead" &&
      c.createdAt !== null &&
      c.createdAt >= new Date(monthStart)
  );
  const geladeiraClients = allClients.filter(
    (c) => c.archivalState === GELADEIRA,
  );

  return {
    activeClientsCount: activeClients.length,
    leadsThisMonth: leadsThisMonth.length,
    // Lifetime/reference count — every row, any status, any archival
    // state. Intentionally unchanged by Geladeira: this is the number that
    // must never shrink just because a relationship went quiet. See
    // docs/architecture/GELADEIRA_DOMAIN_PROTOTYPE.md §5.
    totalClients: allClients.length,
    geladeiraCount: geladeiraClients.length,
  };
}

// Sprint 3 (CRM Lead Workspace): a fast, manual activity/conversation log
// -- the Activity tab was read-only before this (it only ever displayed
// crm_events rows written by other flows: gateway briefings, stage
// changes, /book submissions). This is the one write path an operator
// uses directly, reusing the existing free-text type column -- no new
// table, no generalized workflow/event framework.
export async function logCrmActivity(
  clientId: number,
  data: { type?: string; description: string },
) {
  if (!isPositiveId(clientId)) {
    return { success: false as const, error: "Invalid client." };
  }
  const validation = validateLogCrmActivityInput(data);
  if (!validation.success) {
    return { success: false as const, error: validation.error };
  }

  const db = await getAuthenticatedDb();
  const now = new Date();
  await db.insert(crmEvents).values({
    clientId,
    type: validation.data.type,
    actor: "admin",
    description: validation.data.description,
  });
  await db
    .update(clients)
    .set({ lastInteractionAt: now })
    .where(eq(clients.id, clientId));

  revalidatePath(`/crm/${clientId}`);
  return { success: true as const };
}

export async function getAllClients() {
  // Sprint 3 P2: newest-first -- was ascending, which buried a lead from
  // this morning below one from six months ago in the CRM list's own
  // Leads section (the section that most needs "what just came in").
  const db = await getAuthenticatedDb();
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

// Sprint 3 P1 (Project/Video counts consistency audit): the CRM list page
// showed the same stale clients.totalProjects / clients.totalRevenue
// columns as the client detail page (see getClientIntelligence above for
// the full root-cause note). This computes the same live figures for
// every client at once via two grouped queries -- not one query per
// client -- so the list page stays a flat O(1) query count regardless of
// roster size. Revenue stays grouped by currency; callers must never sum
// across currencies.
export type ClientListStats = {
  projectCounts: Map<number, number>;
  revenueByCurrency: Map<number, Array<{ currency: string; amount: number }>>;
  // MICRO PATCH §2 (Last Active): keyed by client_id, ISO instant of the
  // most recent closed, attributed Work Session across any of the
  // client's projects. Absent = never had one -- never fabricated.
  lastActiveByClient: Map<number, string>;
};

export async function getClientListStats(): Promise<ClientListStats> {
  const db = await getAuthenticatedDb();

  const [projectCountRows, revenueRows, lastActiveByClient] = await Promise.all([
    db
      .select({
        clientId: projects.clientId,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .groupBy(projects.clientId),
    db
      .select({
        clientId: transactions.clientId,
        currency: transactions.currency,
        amount: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(eq(transactions.type, "income"))
      .groupBy(transactions.clientId, transactions.currency),
    getLastActiveByClient(),
  ]);

  const projectCounts = new Map<number, number>();
  for (const row of projectCountRows) {
    projectCounts.set(row.clientId, row.count);
  }

  const revenueByCurrency = new Map<number, Array<{ currency: string; amount: number }>>();
  for (const row of revenueRows) {
    if (row.clientId === null) continue;
    const existing = revenueByCurrency.get(row.clientId) ?? [];
    existing.push({ currency: row.currency, amount: row.amount ?? 0 });
    revenueByCurrency.set(row.clientId, existing);
  }

  return { projectCounts, revenueByCurrency, lastActiveByClient };
}

export async function getClientById(id: number) {
  const db = await getAuthenticatedDb();
  const result = await db.select().from(clients).where(eq(clients.id, id));
  return result[0] ?? null;
}

// --- Client Intelligence (Sunday Systems Round, Phase H) --------------------
//
// Internal-only. Every figure here is derived from data already captured
// for other reasons -- Projects, Video lifecycle, Work Sessions, Video
// Memory, Revisions -- zero new manual input. This backs /crm/[id] (the
// admin CRM surface) only. Never call this from, or forward its result
// to, the client-facing Vault (/client/[token]) or Gateway (/g/[token]) --
// see the PRIVATE OPERATOR INTELLIGENCE vs CLIENT-SAFE INTELLIGENCE
// boundary documented in docs/architecture/SUNDAY_SYSTEMS_ROUND.md.

export type ClientIntelligenceSummary = {
  activeProjectsCount: number;
  videosInProgressCount: number;
  completedVideosCount: number;
  trackedProductionSeconds: number;
  lastWorkedOnIso: string | null;
  recentMemoryNotes: Array<{
    id: number;
    videoId: number;
    videoTitle: string;
    body: string;
    createdAt: string;
  }>;
  revisionCount: number;
  // Sprint 3 P0 (CRM Client Intelligence counts): live-computed, replacing
  // the stale clients.totalProjects / clients.totalRevenue cached columns,
  // which drift from reality (totalProjects only recomputed on
  // create/deleteProject; totalRevenue is written nowhere in the
  // codebase and stays permanently 0). totalProjectsCount is a plain live
  // count of every project row for this client (not filtered to
  // active/review, unlike activeProjectsCount above -- these are two
  // deliberately distinct semantics: "currently active" vs "ever
  // created"). totalRevenueByCurrency is grouped, never summed across
  // currencies (USD and BRL must never be added together).
  totalProjectsCount: number;
  totalRevenueByCurrency: Array<{ currency: string; amount: number }>;
};

const RECENT_MEMORY_NOTE_LIMIT = 5;

export async function getClientIntelligence(
  clientId: number,
): Promise<ClientIntelligenceSummary> {
  const db = await getAuthenticatedDb();

  const [projectRows, videoRows, sessionRows, noteRows, revenueRows] = await Promise.all([
    db
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.clientId, clientId)),
    db
      .select({
        id: videoLogs.id,
        title: videoLogs.title,
        date: videoLogs.date,
        status: videoLogs.status,
        revisionsCount: videoLogs.revisionsCount,
      })
      .from(videoLogs)
      .where(eq(videoLogs.clientId, clientId)),
    db
      .select({
        startedAt: workSessions.startedAt,
        endedAt: workSessions.endedAt,
      })
      .from(workSessions)
      .innerJoin(videoLogs, eq(workSessions.videoId, videoLogs.id))
      .where(eq(videoLogs.clientId, clientId)),
    db
      .select({
        id: crmEvents.id,
        videoId: crmEvents.videoId,
        body: crmEvents.description,
        createdAt: crmEvents.createdAt,
      })
      .from(crmEvents)
      .innerJoin(videoLogs, eq(crmEvents.videoId, videoLogs.id))
      .where(
        and(
          eq(videoLogs.clientId, clientId),
          eq(crmEvents.type, "video.note_added"),
        ),
      )
      .orderBy(desc(crmEvents.createdAt), desc(crmEvents.id))
      .limit(RECENT_MEMORY_NOTE_LIMIT),
    db
      .select({
        currency: transactions.currency,
        amount: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.clientId, clientId),
          eq(transactions.type, "income"),
        ),
      )
      .groupBy(transactions.currency),
  ]);

  const activeProjectsCount = projectRows.filter(
    (row) => row.status === "active" || row.status === "review",
  ).length;
  const videosInProgressCount = videoRows.filter(
    (row) =>
      row.status === "IN_PROGRESS" ||
      row.status === "READY_FOR_REVIEW" ||
      row.status === "CHANGES_REQUESTED",
  ).length;
  const completedVideoRows = videoRows.filter((row) => row.status === "DONE");
  const completedVideosCount = completedVideoRows.length;
  const revisionCount = completedVideoRows.reduce(
    (sum, row) => sum + row.revisionsCount,
    0,
  );

  let trackedProductionSeconds = 0;
  let lastWorkedOnMs: number | null = null;
  for (const session of sessionRows) {
    const startedMs = session.startedAt.getTime();
    if (session.endedAt) {
      trackedProductionSeconds += Math.max(
        0,
        Math.floor((session.endedAt.getTime() - startedMs) / 1_000),
      );
    }
    const latestMs = session.endedAt ? session.endedAt.getTime() : startedMs;
    if (lastWorkedOnMs === null || latestMs > lastWorkedOnMs) {
      lastWorkedOnMs = latestMs;
    }
  }

  const videoTitleById = new Map(
    videoRows.map((row) => [row.id, row.title ?? `Video ${row.date}`]),
  );

  return {
    activeProjectsCount,
    videosInProgressCount,
    completedVideosCount,
    trackedProductionSeconds,
    lastWorkedOnIso:
      lastWorkedOnMs !== null ? new Date(lastWorkedOnMs).toISOString() : null,
    recentMemoryNotes: noteRows
      .filter(
        (row): row is typeof row & { videoId: number } => row.videoId !== null,
      )
      .map((row) => ({
        id: row.id,
        videoId: row.videoId,
        videoTitle: videoTitleById.get(row.videoId) ?? `Video #${row.videoId}`,
        body: row.body,
        createdAt: (row.createdAt ?? new Date(0)).toISOString(),
      })),
    revisionCount,
    totalProjectsCount: projectRows.length,
    totalRevenueByCurrency: revenueRows.map((row) => ({
      currency: row.currency,
      amount: row.amount ?? 0,
    })),
  };
}

type InstagramActionResult =
  | {
      success: true;
      profile: {
        username: string;
        biography: string | null;
        profilePictureUrl: string | null;
      };
    }
  | { success: false; error: string };

function revalidateInstagramViews(clientId: number) {
  revalidatePath("/crm");
  revalidatePath(`/crm/${clientId}`);
}

export async function getInstagramImportStatus() {
  await getAuthenticatedDb();
  return { configured: await isInstagramImportConfigured() };
}

export async function saveInstagramProfile(
  clientId: number,
  input: {
    username: string;
    biography?: string;
    profilePictureUrl?: string;
  },
): Promise<InstagramActionResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid contact." };
  }
  const parsed = validateInstagramProfileInput(input);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const owner = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!owner[0]) return { success: false, error: "Contact not found." };

  await db.batch([
    db
      .update(clients)
      .set({
        instagramUsername: parsed.data.username,
        instagramBio: parsed.data.biography,
        instagramProfilePictureUrl: parsed.data.profilePictureUrl,
        instagramProfileUpdatedAt: new Date(),
      })
      .where(eq(clients.id, clientId)),
    db.insert(crmEvents).values({
      clientId,
      type: "instagram_profile_updated",
      actor: "admin",
      description: `Instagram profile saved: @${parsed.data.username}`,
    }),
  ]);

  revalidateInstagramViews(clientId);
  return { success: true, profile: parsed.data };
}

export async function importInstagramProfile(
  clientId: number,
  rawUsername: string,
): Promise<InstagramActionResult> {
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    return { success: false, error: "Invalid contact." };
  }
  const username = normalizeInstagramUsername(rawUsername);
  if (!username) {
    return { success: false, error: "Enter a valid Instagram username." };
  }

  const db = await getAuthenticatedDb();
  const owner = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!owner[0]) return { success: false, error: "Contact not found." };

  const provider = await getInstagramProvider();
  if (!provider) {
    return {
      success: false,
      error: "Meta Business Discovery is not connected yet. You can still save the profile manually.",
    };
  }

  try {
    const profile = await provider.getProfile(username);
    await db.batch([
      db
        .update(clients)
        .set({
          instagramUsername: profile.username,
          instagramBio: profile.biography,
          instagramProfilePictureUrl: profile.profilePictureUrl,
          instagramProfileUpdatedAt: new Date(),
        })
        .where(eq(clients.id, clientId)),
      db.insert(crmEvents).values({
        clientId,
        type: "instagram_profile_imported",
        actor: "admin",
        description: `Instagram bio and photo imported: @${profile.username}`,
      }),
    ]);
    revalidateInstagramViews(clientId);
    return { success: true, profile };
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Instagram")
      ? error.message
      : "Instagram import failed. Check the handle and Meta connection.";
    return { success: false, error: message };
  }
}


// ─── MICRO PATCH §4: /book highlight ───────────────────────────────────────
// /book originally persisted intake (see submitPublicBookingRequest in
// booking/actions.ts, which writes a crmEvents row of type
// BOOK_REQUEST_EVENT_TYPE on every submission, new lead or repeat client).
// Email notification is still deferred, so this is the only place new
// intake activity becomes visible. No reviewed/unreviewed state exists
// anywhere in the schema without a migration -- per the brief, this
// deliberately does NOT invent one. It's just newest-first, with a direct
// Open Lead action.
//
// Client Service Reality Patch (25 Aug 2026) §18 bonus paper cut: /book
// is now a redirect to /quoteavideo (§2), and /quoteavideo's primary
// "Request a video" path logs QUOTE_REQUEST_EVENT_TYPE, not
// BOOK_REQUEST_EVENT_TYPE (only its embedded, demoted "Need to talk
// first?" call form still logs the latter). Without this, this dashboard
// panel -- Emmanuel's only visibility into new intake, since email
// notification is deferred -- would go silent for every new-video
// request coming through the primary CTA. Both event types are unioned
// here so any public intake path (call request or video request) still
// surfaces.
export type RecentBookRequest = {
  eventId: number;
  clientId: number;
  clientName: string;
  createdAt: string;
};

const RECENT_BOOK_REQUESTS_LIMIT = 5;

export async function getRecentBookRequests(): Promise<RecentBookRequest[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      eventId: crmEvents.id,
      clientId: crmEvents.clientId,
      clientName: clients.name,
      createdAt: crmEvents.createdAt,
    })
    .from(crmEvents)
    .innerJoin(clients, eq(crmEvents.clientId, clients.id))
    .where(inArray(crmEvents.type, [BOOK_REQUEST_EVENT_TYPE, QUOTE_REQUEST_EVENT_TYPE]))
    .orderBy(desc(crmEvents.createdAt))
    .limit(RECENT_BOOK_REQUESTS_LIMIT);

  return rows
    .filter((row): row is typeof row & { clientId: number; createdAt: Date } =>
      row.clientId !== null && row.createdAt !== null,
    )
    .map((row) => ({
      eventId: row.eventId,
      clientId: row.clientId,
      clientName: row.clientName,
      createdAt: row.createdAt.toISOString(),
    }));
}
