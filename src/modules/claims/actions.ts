"use server";
import "server-only";
import { getAuthenticatedDb } from "@/db";
import { claims } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type Result = { success: true; message: string } | { success: false; error: string };
type ClaimType = "FACT" | "INFERENCE" | "HYPOTHESIS";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

export async function recordClaim(input: {
  statement: string;
  type: ClaimType;
  confidence: Confidence;
  evidenceNeeded?: string;
  sourceRefs?: string;
  linkedHypothesisId?: number | null;
}): Promise<Result> {
  if (!input.statement?.trim()) return { success: false, error: "Statement required." };
  const db = await getAuthenticatedDb();
  await db.insert(claims).values({
    statement: input.statement.trim(),
    type: input.type,
    confidence: input.confidence,
    evidenceNeeded: input.evidenceNeeded?.trim() || null,
    sourceRefs: input.sourceRefs?.trim() || null,
    linkedHypothesisId: input.linkedHypothesisId ?? null,
  });
  revalidatePath("/lab");
  return { success: true, message: "Claim recorded." };
}

export async function retireClaim(id: number): Promise<Result> {
  const db = await getAuthenticatedDb();
  await db.update(claims).set({ status: "RETIRED" }).where(eq(claims.id, id));
  revalidatePath("/lab");
  return { success: true, message: "Retired." };
}

export async function listClaims() {
  const db = await getAuthenticatedDb();
  return db.select().from(claims).orderBy(desc(claims.createdAt)).limit(30);
}
