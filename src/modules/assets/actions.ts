"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { assets, sourceMediaReferences } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { validateAssetInput, validateSourceMediaReferenceInput } from "./core";

export type AssetActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── ASSETS (§3) ────────────────────────────────────────────────────────────

export async function createAsset(input: {
  projectId: number;
  videoId?: number | null;
  name: string;
  type: string;
  status?: string;
  reviewUrl?: string | null;
  deliveryUrl?: string | null;
  publishedUrl?: string | null;
  thumbnailUrl?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  source?: string | null;
}): Promise<AssetActionResult> {
  const validated = validateAssetInput(input);
  if (!validated.success) return { success: false, error: validated.error };

  const db = await getAuthenticatedDb();
  await db.insert(assets).values({
    projectId: validated.value.projectId,
    videoId: validated.value.videoId,
    name: validated.value.name,
    type: validated.value.type,
    status: validated.value.status,
    reviewUrl: validated.value.reviewUrl,
    deliveryUrl: validated.value.deliveryUrl,
    publishedUrl: validated.value.publishedUrl,
    thumbnailUrl: validated.value.thumbnailUrl,
    deliveredAt: validated.value.deliveredAt,
    notes: validated.value.notes,
    source: validated.value.source,
  });

  revalidatePath(`/projects/${validated.value.projectId}`);
  return { success: true };
}

export async function updateAsset(
  id: number,
  input: {
    projectId: number;
    videoId?: number | null;
    name: string;
    type: string;
    status?: string;
    reviewUrl?: string | null;
    deliveryUrl?: string | null;
    publishedUrl?: string | null;
    thumbnailUrl?: string | null;
    deliveredAt?: string | null;
    notes?: string | null;
    source?: string | null;
  },
): Promise<AssetActionResult> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: "Invalid asset." };
  }
  const validated = validateAssetInput(input);
  if (!validated.success) return { success: false, error: validated.error };

  const db = await getAuthenticatedDb();
  await db
    .update(assets)
    .set({
      videoId: validated.value.videoId,
      name: validated.value.name,
      type: validated.value.type,
      status: validated.value.status,
      reviewUrl: validated.value.reviewUrl,
      deliveryUrl: validated.value.deliveryUrl,
      publishedUrl: validated.value.publishedUrl,
      thumbnailUrl: validated.value.thumbnailUrl,
      deliveredAt: validated.value.deliveredAt,
      notes: validated.value.notes,
      source: validated.value.source,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, id));

  revalidatePath(`/projects/${validated.value.projectId}`);
  return { success: true };
}

export async function deleteAsset(id: number, projectId: number): Promise<AssetActionResult> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: "Invalid asset." };
  }
  const db = await getAuthenticatedDb();
  await db.delete(assets).where(eq(assets.id, id));
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function getAssetsForProject(projectId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(desc(assets.createdAt));
}

// Project-level assets only (videoId is null) -- used where a surface
// wants to show "assets that belong to the project itself" separate from
// assets attached to a specific video (see §3 "Asset independence").
export async function getProjectLevelAssets(projectId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.projectId, projectId), isNull(assets.videoId)))
    .orderBy(desc(assets.createdAt));
}

export async function getAssetsForVideo(videoId: number) {
  const db = await getAuthenticatedDb();
  return db.select().from(assets).where(eq(assets.videoId, videoId)).orderBy(desc(assets.createdAt));
}

// ─── SOURCE MEDIA REFERENCES (§4) ───────────────────────────────────────────

export async function createSourceMediaReference(input: {
  projectId: number;
  approxSizeLabel?: string | null;
  sourceUrl?: string | null;
  location?: string | null;
  profile?: string | null;
  notes?: string | null;
}): Promise<AssetActionResult> {
  const validated = validateSourceMediaReferenceInput(input);
  if (!validated.success) return { success: false, error: validated.error };

  const db = await getAuthenticatedDb();
  await db.insert(sourceMediaReferences).values(validated.value);
  revalidatePath(`/projects/${validated.value.projectId}`);
  return { success: true };
}

export async function deleteSourceMediaReference(
  id: number,
  projectId: number,
): Promise<AssetActionResult> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { success: false, error: "Invalid source media reference." };
  }
  const db = await getAuthenticatedDb();
  await db.delete(sourceMediaReferences).where(eq(sourceMediaReferences.id, id));
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function getSourceMediaForProject(projectId: number) {
  const db = await getAuthenticatedDb();
  return db
    .select()
    .from(sourceMediaReferences)
    .where(eq(sourceMediaReferences.projectId, projectId))
    .orderBy(desc(sourceMediaReferences.createdAt));
}
