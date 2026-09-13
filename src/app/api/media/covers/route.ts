import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients, crmEvents, projects, videoLogs } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth-server";
import {
  buildCoverObjectKey,
  buildCoverRoute,
  coverObjectKeyFromRoute,
  detectCoverContentType,
  validateCoverUploadMetadata,
  type CoverTargetType,
} from "@/modules/media/core";

type CoverTarget = {
  type: CoverTargetType;
  id: number;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function parseTarget(typeValue: unknown, idValue: unknown): CoverTarget | null {
  if (typeValue !== "video" && typeValue !== "project" && typeValue !== "client") return null;
  const id = Number(idValue);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { type: typeValue, id };
}

async function getMediaBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.MEDIA;
}

async function findTarget(target: CoverTarget) {
  const db = await getDb();
  if (target.type === "video") {
    const rows = await db
      .select({
        id: videoLogs.id,
        clientId: videoLogs.clientId,
        projectId: videoLogs.projectId,
        coverUrl: videoLogs.coverUrl,
        title: videoLogs.title,
      })
      .from(videoLogs)
      .where(eq(videoLogs.id, target.id))
      .limit(1);
    return rows[0] ? { ...rows[0], type: "video" as const } : null;
  }

  if (target.type === "project") {
    const rows = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      coverUrl: projects.coverUrl,
      name: projects.name,
    })
    .from(projects)
    .where(eq(projects.id, target.id))
    .limit(1);
    return rows[0] ? { ...rows[0], type: "project" as const } : null;
  }

  const rows = await db
    .select({
      id: clients.id,
      clientId: clients.id,
      coverUrl: clients.defaultCoverUrl,
      name: clients.name,
    })
    .from(clients)
    .where(eq(clients.id, target.id))
    .limit(1);
  return rows[0] ? { ...rows[0], type: "client" as const } : null;
}

function revalidateCoverTarget(target: Awaited<ReturnType<typeof findTarget>>) {
  if (!target) return;
  revalidatePath("/projects");
  revalidatePath("/productivity");
  if (target.clientId) revalidatePath(`/crm/${target.clientId}`);
  if (target.type === "project") revalidatePath(`/projects/${target.id}`);
  if (target.type === "client") revalidatePath(`/crm/${target.id}`);
  if (target.type === "video" && target.projectId) {
    revalidatePath(`/projects/${target.projectId}`);
  }
}

async function deleteOldObjectIfOwned(bucket: R2Bucket, coverUrl: string | null) {
  const oldKey = coverObjectKeyFromRoute(coverUrl);
  if (!oldKey) return;
  try {
    await bucket.delete(oldKey);
  } catch {
    // The D1 reference is authoritative. A failed best-effort orphan cleanup
    // must not roll back a valid replacement/removal.
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return json({ success: false, error: "Unauthorized." }, 401);
  }

  const formData = await request.formData();
  const target = parseTarget(formData.get("targetType"), formData.get("targetId"));
  const file = formData.get("file");
  if (!target) return json({ success: false, error: "Invalid cover target." }, 400);
  if (!(file instanceof File)) {
    return json({ success: false, error: "Choose an image file." }, 400);
  }

  const metadataError = validateCoverUploadMetadata({
    size: file.size,
    contentType: file.type,
  });
  if (metadataError) return json({ success: false, error: metadataError }, 400);

  const existing = await findTarget(target);
  if (!existing) return json({ success: false, error: "Cover target not found." }, 404);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedContentType = detectCoverContentType(bytes);
  if (!detectedContentType || detectedContentType !== file.type) {
    return json({ success: false, error: "The file contents do not match a supported image type." }, 400);
  }

  const bucket = await getMediaBucket();
  const objectKey = buildCoverObjectKey(detectedContentType, crypto.randomUUID());
  const coverUrl = buildCoverRoute(objectKey);

  await bucket.put(objectKey, bytes, {
    httpMetadata: {
      contentType: detectedContentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { purpose: "cover" },
  });

  const db = await getDb();
  try {
    if (existing.type === "video") {
      const now = new Date();
      await db.batch([
        db
          .update(videoLogs)
          .set({ coverUrl, updatedAt: now })
          .where(eq(videoLogs.id, existing.id)),
        db.insert(crmEvents).values({
          clientId: existing.clientId,
          videoId: existing.id,
          type: "video.updated",
          actor: "admin",
          description: `Video cover updated: ${existing.title ?? `Video ${existing.id}`}`,
          createdAt: now,
        }),
      ]);
    } else if (existing.type === "project") {
      await db
        .update(projects)
        .set({ coverUrl, updatedAt: new Date() })
        .where(eq(projects.id, existing.id));
    } else {
      await db
        .update(clients)
        .set({ defaultCoverUrl: coverUrl })
        .where(eq(clients.id, existing.id));
    }
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }

  await deleteOldObjectIfOwned(bucket, existing.coverUrl);
  revalidateCoverTarget(existing);
  return json({ success: true, coverUrl });
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return json({ success: false, error: "Unauthorized." }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, error: "Invalid request." }, 400);
  }
  const body = payload as { targetType?: unknown; targetId?: unknown };
  const target = parseTarget(body.targetType, body.targetId);
  if (!target) return json({ success: false, error: "Invalid cover target." }, 400);

  const existing = await findTarget(target);
  if (!existing) return json({ success: false, error: "Cover target not found." }, 404);

  const db = await getDb();
  if (existing.type === "video") {
    const now = new Date();
    await db.batch([
      db
        .update(videoLogs)
        .set({ coverUrl: null, updatedAt: now })
        .where(eq(videoLogs.id, existing.id)),
      db.insert(crmEvents).values({
        clientId: existing.clientId,
        videoId: existing.id,
        type: "video.updated",
        actor: "admin",
        description: `Video cover removed: ${existing.title ?? `Video ${existing.id}`}`,
        createdAt: now,
      }),
    ]);
  } else if (existing.type === "project") {
    await db
      .update(projects)
      .set({ coverUrl: null, updatedAt: new Date() })
      .where(eq(projects.id, existing.id));
  } else {
    await db
      .update(clients)
      .set({ defaultCoverUrl: null })
      .where(eq(clients.id, existing.id));
  }

  const bucket = await getMediaBucket();
  await deleteOldObjectIfOwned(bucket, existing.coverUrl);
  revalidateCoverTarget(existing);
  return json({ success: true, coverUrl: null });
}
