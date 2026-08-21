import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import * as schema from "./schema";
import { requireAuth } from "@/lib/auth-server";

export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
});

export const getAuthenticatedDb = cache(async () => {
  await requireAuth();
  return getDb();
});
