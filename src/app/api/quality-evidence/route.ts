import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { qualityEvidence, videoLogs } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth-server";
import {
  buildQualityEvidenceObjectKey,
  detectQualityEvidenceContentType,
  isQualityEvidenceType,
  validateQualityEvidenceInput,
  validateQualityEvidenceUpload,
} from "@/modules/quality-evidence/core";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return json({ success: false, error: "Unauthorized." }, 401);

  const form = await request.formData();
  const type = form.get("type");
  const videoId = Number(form.get("videoId"));
  if (!isQualityEvidenceType(type)) {
    return json({ success: false, error: "Choose image or audio evidence." }, 400);
  }
  const evidenceType = type;
  if (!Number.isSafeInteger(videoId) || videoId <= 0) {
    return json({ success: false, error: "Choose a valid Video." }, 400);
  }

  const db = await getDb();
  const video = await db
    .select({ id: videoLogs.id, clientId: videoLogs.clientId })
    .from(videoLogs)
    .where(eq(videoLogs.id, videoId))
    .limit(1);
  if (!video[0]) return json({ success: false, error: "Video not found." }, 404);

  const { env } = await getCloudflareContext({ async: true });
  const uploadedKeys: string[] = [];

  async function resolveSide(side: "before" | "after") {
    const file = form.get(`${side}File`);
    if (file instanceof File && file.size > 0) {
      const metadataError = validateQualityEvidenceUpload({ type: evidenceType, size: file.size, contentType: file.type });
      if (metadataError) throw new Error(metadataError);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectQualityEvidenceContentType(bytes);
      const normalizedBrowserType = file.type === "audio/x-m4a" ? "audio/mp4" : file.type;
      if (!detected || detected !== normalizedBrowserType) {
        throw new Error("The file contents do not match the declared media type.");
      }
      const key = buildQualityEvidenceObjectKey(detected, crypto.randomUUID());
      await env.MEDIA.put(key, bytes, {
        httpMetadata: {
          contentType: detected,
          cacheControl: "private, no-store",
        },
        customMetadata: { purpose: "quality-evidence", side, evidenceType },
      });
      uploadedKeys.push(key);
      return key;
    }
    const url = form.get(`${side}Url`);
    return typeof url === "string" ? url : null;
  }

  try {
    const beforeReference = await resolveSide("before");
    const afterReference = await resolveSide("after");
    const validated = validateQualityEvidenceInput({
      videoId,
      type: evidenceType,
      label: form.get("label"),
      beforeReference,
      afterReference,
      visibility: form.get("visibility"),
      provenance: "operator:mindbunker-web",
    });
    if (!validated.success) {
      await Promise.all(uploadedKeys.map((key) => env.MEDIA.delete(key)));
      return json({ success: false, error: validated.error }, 400);
    }
    const inserted = await db
      .insert(qualityEvidence)
      .values(validated.value)
      .returning({ id: qualityEvidence.id });
    revalidatePath("/productivity");
    revalidatePath(`/productivity?video=${videoId}`);
    revalidatePath("/client/dashboard");
    revalidatePath(`/client/dashboard/videos/${videoId}`);
    if (video[0].clientId) revalidatePath(`/crm/${video[0].clientId}`);
    return json({ success: true, id: inserted[0].id });
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => env.MEDIA.delete(key)));
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Quality evidence could not be saved.",
    }, 400);
  }
}
