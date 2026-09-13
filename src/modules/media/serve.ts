import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSafeCoverObjectKey } from "./core";

// Dave Monday Release — root cause of the "covers don't appear in the
// Client Portal" defect: the operator build's /media/[...path]/route.ts
// (which this used to be the only copy of) registers at the real Next.js
// path "/media/[...path]" on the operator target (basePath "/mindbunker"),
// but on the CLIENT target basePath is deliberately "" (see next.config.ts's
// own comment on why) -- so a route living outside src/app/client/** never
// gets a "/client" prefix at all, and the Cloudflare Route
// "emmanueldarosa.com/client*" never forwards a bare "/media/..." request
// to this Worker. toClientWorkerCoverUrl (modules/media/core.ts) already
// correctly rewrites cover URLs to "/client/media/<objectKey>" -- it was
// the *route to serve that path* that never existed. Fixed by adding a
// second copy of this route literally under src/app/client/media/, and
// extracting the one real GET handler here so neither copy can drift.
export async function serveCoverObject(
  objectKey: string,
  request: Request,
): Promise<Response> {
  if (!isSafeCoverObjectKey(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MEDIA.get(objectKey, { range: request.headers });
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
