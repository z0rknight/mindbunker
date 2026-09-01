import "server-only";
import { getAuthenticatedDb } from "@/db";
import { clients, projects, videoLogs, commitments } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { mapToCrmState, isFollowUpDue } from "./crm-state";

// Wave 2H/3G: rough state-aware CRM summaries, proving ground only -- does
// NOT touch the canonical /crm page or its data layer.
export async function getLabCrmSummary() {
  const db = await getAuthenticatedDb();
  const rows = await db.select().from(clients);
  const allIds = rows.map((c) => c.id);

  const [projectRows, videoRows, commitmentRows] = allIds.length
    ? await Promise.all([
        db.select().from(projects).where(inArray(projects.clientId, allIds)),
        db.select().from(videoLogs).where(inArray(videoLogs.clientId, allIds)),
        db.select().from(commitments).where(and(eq(commitments.ownerType, "CLIENT"), inArray(commitments.ownerId, allIds), ne(commitments.status, "CANCELLED"))),
      ])
    : [[], [], []];

  const summaries = rows.map((c) => {
    const clientProjects = projectRows.filter((p) => p.clientId === c.id);
    const clientVideos = videoRows.filter((v) => v.clientId === c.id);
    const clientCommitments = commitmentRows.filter((cm) => cm.ownerId === c.id);
    const hasOpenWork = clientProjects.length > 0 || clientVideos.length > 0;
    const state = mapToCrmState(c, hasOpenWork);
    return {
      id: c.id,
      name: c.name,
      state,
      followUpDue: isFollowUpDue(state, c.lastInteractionAt),
      lastInteractionAt: c.lastInteractionAt,
      nextAction: c.nextAction,
      source: c.source,
      contractType: clientProjects.find((p) => p.contractType)?.contractType ?? null,
      openProjects: clientProjects.length,
      openVideos: clientVideos.length,
      openCommitments: clientCommitments.filter((cm) => cm.status === "OPEN").length,
      followUpAgeDays: c.lastInteractionAt ? Math.floor((Date.now() - new Date(c.lastInteractionAt).getTime()) / 86400000) : null,
    };
  });

  return {
    leadLike: summaries.filter((s) => s.state === "LEAD" || s.state === "QUALIFIED" || s.state === "OPPORTUNITY"),
    active: summaries.filter((s) => s.state === "ACTIVE" || s.state === "AT_RISK"),
    other: summaries.filter((s) => !["LEAD", "QUALIFIED", "OPPORTUNITY", "ACTIVE", "AT_RISK"].includes(s.state)),
  };
}
