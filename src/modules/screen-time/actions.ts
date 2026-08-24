"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { screenTimeSnapshots } from "@/db/schema";
import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  validateScreenTimeSnapshotInput,
  normalizeScreenTimeSnapshotInput,
  checkDuplicatePeriod,
  topByHours,
  type ScreenTimeSnapshotInput,
  type ScreenTimeAppInput,
  type ScreenTimeCategoryInput,
} from "./core";

export type ImportScreenTimeSnapshotResult =
  | { success: true; skipped: boolean; warnings: string[]; message: string }
  | { success: false; errors: string[] };

// The entire write path for the /health/screen-time/import prototype: a
// person pastes structured JSON (prepared externally, e.g. by an LLM
// reading Apple's own Screen Time screenshots -- no OCR happens here) and
// this validates, normalizes, and stores it verbatim (rawPayload) alongside
// normalized columns. Never claims automatic sensing.
export async function importScreenTimeSnapshot(
  rawInput: unknown,
): Promise<ImportScreenTimeSnapshotResult> {
  const validation = validateScreenTimeSnapshotInput(rawInput);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  const normalized = normalizeScreenTimeSnapshotInput(
    rawInput as ScreenTimeSnapshotInput,
  );

  const db = await getAuthenticatedDb();
  const existingRows = await db
    .select({
      periodStart: screenTimeSnapshots.periodStart,
      periodEnd: screenTimeSnapshots.periodEnd,
      device: screenTimeSnapshots.device,
      totalMinutes: screenTimeSnapshots.totalMinutes,
    })
    .from(screenTimeSnapshots);

  const dup = checkDuplicatePeriod(normalized, existingRows);
  const warnings = [...validation.warnings];

  if (dup.isDuplicate && dup.isExactRepeat) {
    return {
      success: true,
      skipped: true,
      warnings,
      message: `This exact snapshot (${normalized.periodStart} to ${normalized.periodEnd}, ${normalized.device}) was already imported. No changes made.`,
    };
  }
  if (dup.isDuplicate && !dup.isExactRepeat) {
    warnings.push(
      `A snapshot already exists for ${normalized.periodStart} to ${normalized.periodEnd} on ${normalized.device} with a different total -- stored this one too rather than overwriting either.`,
    );
  }

  await db.insert(screenTimeSnapshots).values({
    periodStart: normalized.periodStart,
    periodEnd: normalized.periodEnd,
    device: normalized.device,
    totalMinutes: normalized.totalMinutes,
    source: "MANUAL_APPLE_SCREEN_TIME_SNAPSHOT",
    rawPayload: JSON.stringify(normalized),
  });

  revalidatePath("/health/screen-time");
  revalidatePath("/health/screen-time/import");
  revalidatePath("/health");

  return {
    success: true,
    skipped: false,
    warnings,
    message: `Imported ${normalized.periodStart} to ${normalized.periodEnd} (${normalized.device}, ${(normalized.totalMinutes / 60).toFixed(1)}h total).`,
  };
}

export type ScreenTimeSnapshotSummary = {
  id: number;
  periodStart: string;
  periodEnd: string;
  device: string;
  totalMinutes: number;
  createdAt: string;
  topApps: { name: string; hours: number }[];
  topCategories: { name: string; hours: number }[];
};

function parseRawPayload(raw: string): {
  categories?: ScreenTimeCategoryInput[];
  apps?: ScreenTimeAppInput[];
} {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getScreenTimeSnapshots(): Promise<
  ScreenTimeSnapshotSummary[]
> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select()
    .from(screenTimeSnapshots)
    .orderBy(desc(screenTimeSnapshots.periodStart));

  return rows.map((row) => {
    const parsed = parseRawPayload(row.rawPayload);
    return {
      id: row.id,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      device: row.device,
      totalMinutes: row.totalMinutes,
      createdAt: row.createdAt.toISOString(),
      topApps: topByHours(parsed.apps ?? [], 5),
      topCategories: topByHours(parsed.categories ?? [], 5),
    };
  });
}

// "This week" is deliberately just "the most recently imported snapshot" --
// nothing here infers or interpolates a week that wasn't actually imported.
export async function getLatestScreenTimeSnapshot(): Promise<ScreenTimeSnapshotSummary | null> {
  const all = await getScreenTimeSnapshots();
  return all[0] ?? null;
}
