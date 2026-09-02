"use server";

import { getAuthenticatedDb } from "@/db";
import { clients, decisions, projects, videoLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  isPositiveId,
  validateRecordDecisionInput,
  validateResultInput,
  type RecordDecisionInput,
} from "./core";

type DecisionActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

function revalidateWarRoom() {
  revalidatePath("/war-room");
  revalidatePath("/");
}

// Operator Intelligence Patch Phase 5: the human decides -- this never
// auto-writes a decision from signal evidence, it only accepts one the
// operator typed, optionally pre-filled with the signal's own context.
export async function recordDecision(input: RecordDecisionInput): Promise<DecisionActionResult> {
  const parsed = validateRecordDecisionInput(input);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  await db.insert(decisions).values({
    signalType: parsed.data.signalType,
    videoId: parsed.data.videoId,
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId,
    decision: parsed.data.decision,
    reviewAt: parsed.data.reviewAt,
    status: "OPEN",
  });

  revalidateWarRoom();
  return { success: true, message: "Decision recorded." };
}

export async function recordDecisionResult(
  decisionId: number,
  result: string,
): Promise<DecisionActionResult> {
  if (!isPositiveId(decisionId)) {
    return { success: false, error: "Invalid decision." };
  }
  const parsed = validateResultInput(result);
  if (!parsed.success) return parsed;

  const db = await getAuthenticatedDb();
  const existing = await db
    .select({ id: decisions.id, status: decisions.status })
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1);
  if (!existing[0]) return { success: false, error: "Decision not found." };
  if (existing[0].status !== "OPEN") {
    return { success: false, error: "This decision is already resolved." };
  }

  await db
    .update(decisions)
    .set({ result: parsed.result, status: "REVIEWED", resolvedAt: new Date() })
    .where(eq(decisions.id, decisionId));

  revalidateWarRoom();
  return { success: true, message: "Result recorded." };
}

export async function cancelDecision(decisionId: number): Promise<DecisionActionResult> {
  if (!isPositiveId(decisionId)) {
    return { success: false, error: "Invalid decision." };
  }
  const db = await getAuthenticatedDb();
  const existing = await db
    .select({ id: decisions.id, status: decisions.status })
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1);
  if (!existing[0]) return { success: false, error: "Decision not found." };
  if (existing[0].status !== "OPEN") {
    return { success: false, error: "This decision is already resolved." };
  }

  await db
    .update(decisions)
    .set({ status: "CANCELLED", resolvedAt: new Date() })
    .where(eq(decisions.id, decisionId));

  revalidateWarRoom();
  return { success: true, message: "Decision cancelled." };
}

export type OpenDecisionRow = {
  id: number;
  createdAt: Date;
  signalType: string | null;
  decision: string;
  reviewAt: Date | null;
  status: "OPEN" | "REVIEWED" | "CANCELLED";
  videoTitle: string | null;
  clientName: string | null;
  projectName: string | null;
};

export async function listOpenDecisions(): Promise<OpenDecisionRow[]> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: decisions.id,
      createdAt: decisions.createdAt,
      signalType: decisions.signalType,
      decision: decisions.decision,
      reviewAt: decisions.reviewAt,
      status: decisions.status,
      videoTitle: videoLogs.title,
      clientName: clients.name,
      projectName: projects.name,
    })
    .from(decisions)
    .leftJoin(videoLogs, eq(videoLogs.id, decisions.videoId))
    .leftJoin(clients, eq(clients.id, decisions.clientId))
    .leftJoin(projects, eq(projects.id, decisions.projectId))
    .where(eq(decisions.status, "OPEN"))
    .orderBy(desc(decisions.createdAt));
  return rows;
}
