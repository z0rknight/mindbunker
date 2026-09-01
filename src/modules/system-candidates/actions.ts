"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { frictionEvents, systemCandidateVerdicts, systemInterventions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { detectSystemCandidates } from "./core";

type Result = { success: true; message: string } | { success: false; error: string };
type Verdict = "IGNORE" | "WATCH" | "SYSTEMIZE";

export async function getSystemCandidates() {
  const db = await getAuthenticatedDb();
  const [events, verdicts] = await Promise.all([
    db.select({ category: frictionEvents.category, note: frictionEvents.note, minutesLost: frictionEvents.minutesLost }).from(frictionEvents),
    db.select().from(systemCandidateVerdicts),
  ]);
  const candidates = detectSystemCandidates(events);
  const verdictByKey = new Map(verdicts.map((v) => [v.candidateKey, v]));
  return candidates.map((c) => ({ ...c, verdict: verdictByKey.get(c.key)?.verdict ?? null }));
}

export async function setSystemCandidateVerdict(key: string, verdict: Verdict, note?: string): Promise<Result> {
  const db = await getAuthenticatedDb();
  const existing = await db.select({ id: systemCandidateVerdicts.id }).from(systemCandidateVerdicts).where(eq(systemCandidateVerdicts.candidateKey, key)).limit(1);
  if (existing[0]) {
    await db.update(systemCandidateVerdicts).set({ verdict, note: note?.trim() || null }).where(eq(systemCandidateVerdicts.id, existing[0].id));
  } else {
    await db.insert(systemCandidateVerdicts).values({ candidateKey: key, verdict, note: note?.trim() || null });
  }
  revalidatePath("/lab");
  return { success: true, message: "Verdict saved." };
}

export async function recordSystemIntervention(input: { name: string; problem?: string; before?: string; after?: string; relatedFrictionCategory?: string }): Promise<Result> {
  if (!input.name?.trim()) return { success: false, error: "Name required." };
  const db = await getAuthenticatedDb();
  await db.insert(systemInterventions).values({
    name: input.name.trim(),
    problem: input.problem?.trim() || null,
    before: input.before?.trim() || null,
    after: input.after?.trim() || null,
    relatedFrictionCategory: input.relatedFrictionCategory || null,
  });
  revalidatePath("/lab");
  return { success: true, message: "Intervention recorded." };
}

export async function listSystemInterventions() {
  const db = await getAuthenticatedDb();
  return db.select().from(systemInterventions).orderBy(desc(systemInterventions.createdAt));
}
