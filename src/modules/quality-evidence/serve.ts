import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { projects, qualityEvidence, videoLogs } from "@/db/schema";
import { canonicalClientId, operationalClientIdsForCanonical } from "@/lib/client-identity";
import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { isQualityEvidenceObjectKey, type QualityEvidenceSide } from "./core";

function selectReference(side: QualityEvidenceSide) {
  return side === "before" ? qualityEvidence.beforeReference : qualityEvidence.afterReference;
}

export async function getOperatorQualityEvidenceReference(id: number, side: QualityEvidenceSide) {
  const db = await getDb();
  const reference = selectReference(side);
  const rows = await db
    .select({ reference })
    .from(qualityEvidence)
    .where(eq(qualityEvidence.id, id))
    .limit(1);
  return rows[0]?.reference ?? null;
}

export async function getClientQualityEvidenceReference(
  authenticatedClientId: number,
  id: number,
  side: QualityEvidenceSide,
) {
  const canonicalId = canonicalClientId(authenticatedClientId);
  const scope = operationalClientIdsForCanonical(canonicalId);
  const db = await getDb();
  const reference = selectReference(side);
  const rows = await db
    .select({ reference })
    .from(qualityEvidence)
    .innerJoin(videoLogs, eq(qualityEvidence.videoId, videoLogs.id))
    .innerJoin(projects, eq(videoLogs.projectId, projects.id))
    .where(and(
      eq(qualityEvidence.id, id),
      eq(qualityEvidence.visibility, "CLIENT_SAFE"),
      isNotNull(qualityEvidence.beforeReference),
      isNotNull(qualityEvidence.afterReference),
      inArray(videoLogs.clientId, scope),
      inArray(projects.clientId, scope),
      eq(videoLogs.visibleToClient, true),
      eq(projects.visibleToClient, true),
      ne(projects.status, "archived"),
      eq(videoLogs.isOperationalContainer, false),
      isNull(videoLogs.cancelledAt),
    ))
    .limit(1);
  return rows[0]?.reference ?? null;
}

export async function serveQualityEvidenceReference(reference: string | null, request: Request) {
  if (!reference) return new Response("Not found", { status: 404 });
  if (reference.startsWith("https://")) {
    return Response.redirect(reference, 307);
  }
  if (!isQualityEvidenceObjectKey(reference)) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MEDIA.get(reference, { range: request.headers });
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");

  let status = 200;
  const range = object.range;
  if (
    request.headers.has("range") &&
    range &&
    "offset" in range &&
    "length" in range &&
    typeof range.offset === "number" &&
    typeof range.length === "number"
  ) {
    status = 206;
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
  } else {
    headers.set("content-length", String(object.size));
  }
  return new Response(object.body, { status, headers });
}
