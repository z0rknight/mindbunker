import "server-only";

import { getDb } from "@/db";
import { sensorDevices } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  extractBearerToken,
  hashSensorToken,
  parseScopes,
  parseSensorToken,
  type SensorScope,
} from "./core";

export type AuthenticatedSensorDevice = {
  id: number;
  publicId: string;
  name: string;
  scopes: Set<SensorScope>;
};

export async function authenticateSensorRequest(
  request: Request,
  requiredScope: SensorScope,
): Promise<AuthenticatedSensorDevice | null> {
  const parsed = parseSensorToken(extractBearerToken(request));
  if (!parsed) return null;
  const db = await getDb();
  const tokenHash = await hashSensorToken(parsed.token);
  const row = (
    await db
      .select({
        id: sensorDevices.id,
        publicId: sensorDevices.publicId,
        name: sensorDevices.name,
        scopes: sensorDevices.scopes,
      })
      .from(sensorDevices)
      .where(
        and(
          eq(sensorDevices.publicId, parsed.publicId),
          eq(sensorDevices.tokenHash, tokenHash),
          isNull(sensorDevices.revokedAt),
        ),
      )
      .limit(1)
  )[0];
  if (!row) return null;
  const scopes = parseScopes(row.scopes);
  if (!scopes.has(requiredScope)) return null;
  await db
    .update(sensorDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(sensorDevices.id, row.id));
  return { ...row, scopes };
}

export function sensorUnauthorized() {
  return Response.json({ error: "Invalid or revoked sensor credential." }, { status: 401 });
}

export async function readJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256_000) throw new Error("Payload too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 256_000) {
    throw new Error("Payload too large.");
  }
  return JSON.parse(text) as unknown;
}
