import { serveCoverObject } from "@/modules/media/serve";

// Operator build only -- reachable at /mindbunker/media/... (basePath
// "/mindbunker"). See src/app/client/media/[...path]/route.ts for the
// client-target twin this route needs to stay reachable from
// emmanueldarosa.com/client* -- and modules/media/serve.ts for why a
// second copy of this route exists at all, and for the one real handler
// both copies call.
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return serveCoverObject(path.join("/"), request);
}
