import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IS_CLIENT_DEPLOY_TARGET } from "@/lib/auth-core";

// TEMPORARY -- AUTH RUNTIME PROOF ROUND (Sep 2026). Not a real route, not
// linked from anywhere, not part of the Client Portal. Exists only to
// answer one live question this environment cannot answer any other way
// (no Cloudflare log access reachable from here): does this specific
// Worker actually see env.AUTH_SESSION_SECRET at runtime, and if not,
// exactly which step in getClientAuthRuntime()'s chain fails first.
//
// Reports BOOLEAN PRESENCE AND STRUCTURE ONLY -- never a secret value,
// cookie, session token, password hash, or D1 row content. The one
// exception is a caught exception's own .name/.message, which is safe
// here because every throw point on this exact chain is either a
// framework-internal TypeError/ReferenceError (never embeds secret
// material) or this app's own hardcoded, secret-free string
// ("MindBunker authentication secrets are not configured.").
//
// To be deleted in this same round once the real failure point is
// confirmed -- see the mission report for removal confirmation.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!IS_CLIENT_DEPLOY_TARGET) {
    return new Response("Not found", { status: 404 });
  }

  const diag: Record<string, unknown> = {
    route: "client/runtime-diag-temp",
    isClientDeployTarget: IS_CLIENT_DEPLOY_TARGET,
  };

  let ctx: Awaited<ReturnType<typeof getCloudflareContext>> | undefined;
  try {
    ctx = await getCloudflareContext({ async: true });
    diag.getCloudflareContextSucceeded = true;
  } catch (err) {
    diag.getCloudflareContextSucceeded = false;
    diag.getCloudflareContextErrorName = err instanceof Error ? err.name : typeof err;
    diag.getCloudflareContextErrorMessage = err instanceof Error ? err.message : String(err);
    return Response.json(diag, { status: 200 });
  }

  diag.envExists = Boolean(ctx?.env);

  const env = ctx?.env as unknown as Record<string, unknown> | undefined;
  diag.AUTH_SESSION_SECRET_PRESENT = Boolean(env?.AUTH_SESSION_SECRET);
  diag.AUTH_SESSION_SECRET_TYPE = typeof env?.AUTH_SESSION_SECRET;
  diag.DB_PRESENT = Boolean(env?.DB);
  diag.MEDIA_PRESENT = Boolean(env?.MEDIA);
  diag.ASSETS_PRESENT = Boolean(env?.ASSETS);
  diag.envKeys = env ? Object.keys(env).sort() : null;

  return Response.json(diag, { status: 200 });
}
