import { serveCoverObject } from "@/modules/media/serve";

// Dave Monday Release fix: on the CLIENT build, basePath is deliberately
// "" (see next.config.ts's own comment), so a route outside src/app/client/**
// never becomes reachable at emmanueldarosa.com/client* -- the operator-
// only twin at src/app/media/[...path]/route.ts was never reachable from
// this Worker, which is the actual root cause of covers not appearing in
// the Client Portal (confirmed live: a direct hit on
// /client/media/covers/<key> 404'd before this route existed).
// toClientWorkerCoverUrl (modules/media/core.ts) already rewrites cover
// URLs to exactly this path -- this route is what makes that path real.
// See modules/media/serve.ts for the one shared handler both copies call.
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return serveCoverObject(path.join("/"), request);
}
