"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { decisions, hypotheses, experiments } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };
const VERDICTS = ["KEEP", "PATCH", "KILL", "INCONCLUSIVE"] as const;
export type Verdict = (typeof VERDICTS)[number];

export async function recordDecision(statement: string, context?: string | null): Promise<Result> {
  if (!statement?.trim()) return { success: false, error: "Statement required." };
  const db = await getAuthenticatedDb();
  await db.insert(decisions).values({ statement: statement.trim(), context: context?.trim() || null });
  revalidatePath("/lab");
  return { success: true, message: "Decision recorded." };
}

export async function recordHypothesis(statement: string, evidenceNeeded?: string | null): Promise<Result> {
  if (!statement?.trim()) return { success: false, error: "Statement required." };
  const db = await getAuthenticatedDb();
  await db.insert(hypotheses).values({ statement: statement.trim(), evidenceNeeded: evidenceNeeded?.trim() || null });
  revalidatePath("/lab");
  return { success: true, message: "Hypothesis recorded." };
}

export async function recordExperiment(hypothesisId: number | null, successCondition: string): Promise<Result> {
  if (!successCondition?.trim()) return { success: false, error: "Success condition required." };
  const db = await getAuthenticatedDb();
  await db.insert(experiments).values({ hypothesisId, successCondition: successCondition.trim() });
  revalidatePath("/lab");
  return { success: true, message: "Experiment recorded." };
}

export async function resolveExperiment(id: number, result: string, verdict: Verdict): Promise<Result> {
  if (!VERDICTS.includes(verdict)) return { success: false, error: "Invalid verdict." };
  const db = await getAuthenticatedDb();
  await db.update(experiments).set({ result: result.trim(), verdict, resolvedAt: new Date() }).where(eq(experiments.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Experiment resolved." };
}

export async function listDecisionLog() {
  const db = await getAuthenticatedDb();
  const [d, h, e] = await Promise.all([
    db.select().from(decisions).orderBy(desc(decisions.createdAt)).limit(20),
    db.select().from(hypotheses).orderBy(desc(hypotheses.createdAt)).limit(20),
    db.select().from(experiments).orderBy(desc(experiments.createdAt)).limit(20),
  ]);
  return { decisions: d, hypotheses: h, experiments: e };
}
