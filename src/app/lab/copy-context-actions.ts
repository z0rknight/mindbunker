"use server";
import "server-only";
import { getVideoWorkbenchData } from "./video-workbench-actions";
import { getMorningBrief, getEndOfDayClose } from "./ops-data";
import { getCurrentWorkContext } from "./current-work-data";
import { listBlockers } from "@/modules/blockers/actions";
import { getBusinessPressureFacts } from "./business-pressure-data";
import { listOpenActionItems } from "@/modules/action-items/actions";

// Wave 3U: plain-text export for pasting into a future Claude/Codex
// prompt. No API integration -- the client component copies this string
// to the clipboard.
export async function buildVideoContextText(videoId: number): Promise<string> {
  const d = await getVideoWorkbenchData(videoId);
  if (!d.video) return "Video not found.";
  const lines: string[] = [];
  lines.push(`VIDEO: ${d.video.title ?? `#${d.video.id}`} (id ${d.video.id})`);
  lines.push(`CURRENT STATE: ${d.video.status}${d.lifecycle.currentStage ? ` / lifecycle: ${d.lifecycle.currentStage}` : ""}`);
  lines.push(`NEXT ACTION: ${d.video.nextAction ?? "—"}`);
  lines.push(`WAITING ON: ${d.video.waitingOn ?? "—"}`);
  lines.push("");
  lines.push(`COMMITMENTS (${d.commitments.length}):`);
  for (const c of d.commitments) lines.push(`- [${c.status}] ${c.description}${c.dueAt ? ` (due ${new Date(c.dueAt).toLocaleDateString()})` : ""}`);
  lines.push("");
  lines.push(`FRICTION (${d.friction.length}):`);
  for (const f of d.friction) lines.push(`- ${f.category}${f.note ? `: ${f.note}` : ""}`);
  lines.push("");
  lines.push(`QA (${d.qa.length}):`);
  for (const q of d.qa) lines.push(`- ${q.result}${q.causedBy ? ` (${q.causedBy})` : ""}`);
  lines.push("");
  lines.push(`DELIVERIES (${d.deliveries.length}):`);
  for (const del of d.deliveries) lines.push(`- v${del.version} ${del.status} ${new Date(del.deliveredAt).toLocaleDateString()}`);
  lines.push("");
  lines.push(`REVISIONS (${d.revisions.length}):`);
  for (const r of d.revisions) lines.push(`- ${r.causedBy}${r.note ? `: ${r.note}` : ""}`);
  lines.push("");
  lines.push(`ECONOMICS: tracked ${(d.economics.totalTrackedSeconds / 3600).toFixed(1)}h, coverage ${d.economics.dataCoverage}, avoidable QA ${d.economics.avoidableQaCount}`);
  lines.push("");
  lines.push(`SOURCE IDS: video=${d.video.id}${d.video.clientId ? ` client=${d.video.clientId}` : ""}${d.video.projectId ? ` project=${d.video.projectId}` : ""}`);
  lines.push("");
  lines.push("OPEN QUESTIONS: (fill in before pasting to Claude)");
  return lines.join("\n");
}


// Wave 4W: plain-text export of the CURRENT DAY's full operator context --
// for pasting into a future Claude/Codex prompt or a manual archive note.
// No API integration. Deliberately reuses the same read models Morning
// Brief / End of Day / Current Work / Business Pressure already compute --
// no new aggregation logic is introduced here, only formatting.
export async function buildDayContextText(): Promise<string> {
  const [morning, endOfDay, currentWork, openBlockers, pressure, radar] = await Promise.all([
    getMorningBrief(),
    getEndOfDayClose(),
    getCurrentWorkContext(),
    listBlockers(),
    getBusinessPressureFacts(),
    listOpenActionItems(20),
  ]);
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`OPERATOR SNAPSHOT — ${today}`);
  lines.push("");
  lines.push("CURRENT WORK:");
  if (currentWork.openSession) {
    lines.push(`- Active session on video #${currentWork.openSession.videoId}, elapsed ${Math.round(currentWork.elapsedSeconds / 60)}min${currentWork.stale ? " (STALE)" : ""}`);
    lines.push(`- NEXT ACTION: ${currentWork.video?.nextAction ?? "—"}`);
    lines.push(`- WAITING ON: ${currentWork.video?.waitingOn ?? "—"}`);
  } else {
    lines.push("- No active session.");
  }
  lines.push("");
  lines.push("DEADLINES / COMMITMENTS DUE:");
  for (const c of morning.dueOrOverdueCommitments) lines.push(`- [${c.status}] ${c.description}${c.dueAt ? ` (due ${new Date(c.dueAt).toLocaleDateString()})` : ""}`);
  if (morning.dueOrOverdueCommitments.length === 0) lines.push("- None with a due date.");
  lines.push("");
  lines.push(`WORK SESSIONS TODAY: ${endOfDay.videosProgressed} video(s), ${(endOfDay.trackedSeconds / 3600).toFixed(1)}h tracked`);
  lines.push(`FRICTION / REVISIONS TODAY: ${endOfDay.frictionOrRevisionsToday}`);
  lines.push("");
  lines.push(`BLOCKERS OPEN (${openBlockers.filter((b) => !b.resolvedAt).length}):`);
  for (const b of openBlockers.filter((b) => !b.resolvedAt)) lines.push(`- [${b.category}] ${b.note ?? "(no note)"} (${b.ownerType} #${b.ownerId})`);
  if (openBlockers.filter((b) => !b.resolvedAt).length === 0) lines.push("- None open.");
  lines.push("");
  lines.push(`QA EVENTS TODAY: ${endOfDay.qaEventsToday}`);
  lines.push(`DELIVERIES TODAY: ${endOfDay.deliveriesToday}`);
  lines.push("");
  lines.push(`ACTION RADAR (top ${radar.length}):`);
  for (const r of radar.slice(0, 10)) lines.push(`- [${r.priority}] ${r.title}`);
  lines.push("");
  lines.push("FINANCE CONTEXT:");
  lines.push(`- Cash reconciliation: ${pressure.cashReconciledStatus} (${pressure.reconciledPockets}/${pressure.expectedPockets} pockets) — ${pressure.cashReconciledReason}`);
  lines.push(`- Debts due: ${pressure.debtsDueCount}`);
  lines.push(`- Open commitments (all owners): ${pressure.openCommitmentCount}`);
  lines.push("");
  lines.push("ECONOMICS: see Project/Client Economics panel for a specific project or client -- not summarized here to avoid a misleading single number.");
  lines.push("");
  lines.push("OPEN QUESTIONS: (fill in before pasting to Claude)");
  return lines.join("\n");
}
