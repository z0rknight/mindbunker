"use server";

import { getAuthenticatedDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type PortalCapability = "financials" | "review" | "priority";

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

export async function setClientPortalCapability(
  clientId: number,
  capability: PortalCapability,
  enabled: boolean,
) {
  if (!validId(clientId) || typeof enabled !== "boolean") {
    return { success: false as const, error: "Invalid portal setting." };
  }
  const column = {
    financials: "portalCanSeeFinancials",
    review: "portalCanReview",
    priority: "portalCanSetPriority",
  }[capability] as
    | "portalCanSeeFinancials"
    | "portalCanReview"
    | "portalCanSetPriority";
  const db = await getAuthenticatedDb();
  const current = await db.select({ id: clients.id, value: clients[column] }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!current[0]) return { success: false as const, error: "Client not found." };
  if (current[0].value === enabled) return { success: true as const };
  await db.batch([
    db.update(clients).set({ [column]: enabled }).where(eq(clients.id, clientId)),
    db.insert(crmEvents).values({
      clientId,
      actor: "admin",
      type: "client_portal.capability_changed",
      description: `Client portal ${capability} ${enabled ? "enabled" : "disabled"}`,
    }),
  ]);
  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/client/dashboard");
  return { success: true as const };
}

// Operator Discovery + Portal Personalization patch (2026-09-14):
// DASHBOARD LAYOUT toggles -- whether a section renders at all -- kept
// deliberately separate from setClientPortalCapability above (which gates
// real actions/data: financials, review, priority) and from
// setProjectClientVisibility/setVideoClientVisibility below (which gate
// whether a specific record is visible anywhere). This action only ever
// flips one of the small, allowlisted portalShow* columns; it can never
// touch a capability or a record's own visibility.
type DashboardSection =
  | "currentAccount"
  | "search"
  | "summary"
  | "activeWork"
  | "recentDeliveries"
  | "completedByType"
  | "videoLibrary";

const DASHBOARD_SECTION_COLUMN = {
  currentAccount: "portalShowCurrentAccount",
  search: "portalShowSearch",
  summary: "portalShowSummary",
  activeWork: "portalShowActiveWork",
  recentDeliveries: "portalShowRecentDeliveries",
  completedByType: "portalShowCompletedByType",
  videoLibrary: "portalShowVideoLibrary",
} as const satisfies Record<DashboardSection, keyof typeof clients.$inferSelect>;

export async function setClientDashboardSection(
  clientId: number,
  section: DashboardSection,
  visible: boolean,
) {
  if (!validId(clientId) || typeof visible !== "boolean") {
    return { success: false as const, error: "Invalid dashboard section setting." };
  }
  const column = DASHBOARD_SECTION_COLUMN[section];
  if (!column) return { success: false as const, error: "Unknown dashboard section." };
  const db = await getAuthenticatedDb();
  const current = await db.select({ id: clients.id, value: clients[column] }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!current[0]) return { success: false as const, error: "Client not found." };
  if (current[0].value === visible) return { success: true as const };
  await db.batch([
    db.update(clients).set({ [column]: visible }).where(eq(clients.id, clientId)),
    db.insert(crmEvents).values({
      clientId,
      actor: "admin",
      type: "client_portal.dashboard_section_changed",
      description: `Client dashboard section "${section}" ${visible ? "shown" : "hidden"}`,
    }),
  ]);
  revalidatePath(`/crm/${clientId}`);
  revalidatePath("/client/dashboard");
  return { success: true as const };
}

export async function setProjectClientVisibility(projectId: number, visible: boolean) {
  if (!validId(projectId) || typeof visible !== "boolean") return { success: false as const, error: "Invalid project setting." };
  const db = await getAuthenticatedDb();
  const current = await db.select({ id: projects.id, clientId: projects.clientId, visible: projects.visibleToClient }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!current[0]) return { success: false as const, error: "Project not found." };
  if (current[0].visible === visible) return { success: true as const };
  await db.batch([
    db.update(projects).set({ visibleToClient: visible, updatedAt: new Date() }).where(eq(projects.id, projectId)),
    db.insert(crmEvents).values({
      clientId: current[0].clientId,
      actor: "admin",
      type: "client_portal.visibility_changed",
      description: `Project visibility ${visible ? "enabled" : "disabled"}`,
    }),
  ]);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/client/dashboard");
  return { success: true as const };
}

export async function setVideoClientVisibility(videoId: number, visible: boolean) {
  if (!validId(videoId) || typeof visible !== "boolean") return { success: false as const, error: "Invalid video setting." };
  const db = await getAuthenticatedDb();
  const current = await db.select({ id: videoLogs.id, clientId: videoLogs.clientId, visible: videoLogs.visibleToClient }).from(videoLogs).where(eq(videoLogs.id, videoId)).limit(1);
  if (!current[0]) return { success: false as const, error: "Video not found." };
  if (current[0].visible === visible) return { success: true as const };
  await db.batch([
    db.update(videoLogs).set({ visibleToClient: visible, updatedAt: new Date() }).where(eq(videoLogs.id, videoId)),
    db.insert(crmEvents).values({
      clientId: current[0].clientId,
      videoId,
      actor: "admin",
      type: "client_portal.visibility_changed",
      description: `Video visibility ${visible ? "enabled" : "disabled"}`,
    }),
  ]);
  revalidatePath("/productivity");
  revalidatePath("/client/dashboard");
  return { success: true as const };
}
