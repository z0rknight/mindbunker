import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAuthenticated } from "@/lib/auth-server";
import {
  ACTIVITYWATCH_R2_PREFIX,
} from "@/modules/activitywatch/config";
import {
  deriveBucketIdAndHostname,
  detectBucketTypeFromFilename,
} from "@/modules/activitywatch/core";

// Pre-Operation Reality Hardening — ActivityWatch Import round.
//
// Deliberately a plain Route Handler receiving a raw POST body, NOT a
// Server Action and NOT multipart FormData. Both of those would require
// Next/undici to fully buffer the request body into memory before the
// handler even runs -- unsafe for a ~64MB window-watcher export in a
// Worker isolate with ~128MB total memory (see actions.ts's ARCHITECTURE
// comment for the full reasoning). request.body here is a
// ReadableStream<Uint8Array> piped straight into R2's put(), so the
// Worker never materializes the whole file as a JS value at any point in
// this handler.
function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

async function getMediaBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.MEDIA;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return json({ success: false, error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const filename = url.searchParams.get("filename");
  const fileFingerprint = url.searchParams.get("fileFingerprint");
  if (!filename || !fileFingerprint) {
    return json({ success: false, error: "Missing filename or fileFingerprint." }, 400);
  }

  const bucketType = detectBucketTypeFromFilename(filename);
  if (!bucketType) {
    return json(
      {
        success: false,
        error:
          "Only aw-watcher-window_* and aw-watcher-afk_* ActivityWatch export files are supported.",
      },
      400,
    );
  }
  const { bucketId, hostname } = deriveBucketIdAndHostname(filename, bucketType);

  if (!request.body) {
    return json({ success: false, error: "Empty upload." }, 400);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return json({ success: false, error: "Missing or invalid Content-Length." }, 400);
  }

  const objectKey = `${ACTIVITYWATCH_R2_PREFIX}${crypto.randomUUID()}.json`;
  const bucket = await getMediaBucket();

  try {
    await bucket.put(objectKey, request.body, {
      httpMetadata: { contentType: "application/json" },
    });
  } catch {
    return json({ success: false, error: "Upload failed. Please try again." }, 502);
  }

  return json({
    success: true,
    r2ObjectKey: objectKey,
    bucketId,
    bucketType,
    hostname,
    fileFingerprint,
    fileSizeBytes: contentLength,
  });
}
