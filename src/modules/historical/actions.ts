"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  histFacts,
  histIdentities,
  histIdentitySourceLabels,
  histImportBatches,
  histSourceCoverage,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import manifestJson from "./artifact/v0_1_0/manifest_v0.json";
import historicalFactsJson from "./artifact/v0_1_0/historical_facts_v0.json";
import identityMapJson from "./artifact/v0_1_0/identity_map_v0.json";
import sourceCoverageJson from "./artifact/v0_1_0/source_coverage_v0.json";
import {
  computeHistArtifactFingerprint,
  mapCoverageStatus,
  validateHistArtifactBundle,
  type HistArtifactBundle,
} from "./core.ts";

// Bound to comfortably clear D1/SQLite's default bound-parameter ceiling
// (999) per statement even for the widest table (hist_facts, ~15 columns):
// 15 * 40 = 600 params/statement, leaving headroom.
const INSERT_CHUNK_SIZE = 40;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const BUNDLE: HistArtifactBundle = {
  manifest: manifestJson as HistArtifactBundle["manifest"],
  historicalFacts:
    historicalFactsJson as HistArtifactBundle["historicalFacts"],
  identityMap: identityMapJson as HistArtifactBundle["identityMap"],
  sourceCoverage: sourceCoverageJson as HistArtifactBundle["sourceCoverage"],
};

export type ImportHistoricalArtifactResult =
  | {
      success: true;
      skipped: boolean;
      batchId: number;
      message: string;
    }
  | {
      success: false;
      error: string;
      validationErrors?: string[];
    };

// Deterministic, idempotent, additive-only importer for the Sprint 1.2 P0
// Historical Reference Layer. Never touches Client/Project/Video/WorkSession
// tables. Re-running this with the same embedded artifact content is a
// no-op (detected via content fingerprint) rather than a duplicate import.
export async function importHistoricalArtifact(): Promise<ImportHistoricalArtifactResult> {
  const validation = validateHistArtifactBundle(BUNDLE);
  if (!validation.valid) {
    return {
      success: false,
      error: "Embedded artifact failed contract validation.",
      validationErrors: validation.errors,
    };
  }

  const fingerprint = await computeHistArtifactFingerprint(BUNDLE);
  const db = await getAuthenticatedDb();

  const existing = await db
    .select({ id: histImportBatches.id, status: histImportBatches.status })
    .from(histImportBatches)
    .where(eq(histImportBatches.fingerprint, fingerprint))
    .limit(1);

  let batchId: number;

  if (existing[0]) {
    if (existing[0].status === "ACTIVE") {
      return {
        success: true,
        skipped: true,
        batchId: existing[0].id,
        message:
          "This exact artifact content is already the active historical batch. No changes made.",
      };
    }
    if (existing[0].status === "SUPERSEDED") {
      return {
        success: true,
        skipped: true,
        batchId: existing[0].id,
        message:
          "This exact artifact content was already imported previously and superseded by a later import. Re-activating an old batch is not supported by this action -- no changes made.",
      };
    }
    // status === "PENDING": a prior import attempt inserted the batch row
    // but failed (or was interrupted) before the row-insert-and-activate
    // batch completed. Reuse the same batch id rather than creating a
    // second PENDING row for identical content.
    batchId = existing[0].id;
  } else {
    const inserted = await db
      .insert(histImportBatches)
      .values({
        artifactVersion: BUNDLE.manifest.contract_version,
        fingerprint,
        status: "PENDING",
        factCount: BUNDLE.historicalFacts.facts.length,
        identityCount: BUNDLE.identityMap.identities.length,
        coverageMonthCount: BUNDLE.sourceCoverage.months.length,
      })
      .returning({ id: histImportBatches.id });
    const insertedRow = inserted[0];
    if (!insertedRow) {
      return { success: false, error: "Failed to create import batch row." };
    }
    batchId = insertedRow.id;
  }

  const identityRows = BUNDLE.identityMap.identities.map((identity) => ({
    batchId,
    canonicalId: identity.canonical_id,
    canonicalLabel: identity.canonical_label,
    identityType: identity.identity_type as (typeof histIdentities.$inferInsert)["identityType"],
    resolutionStatus:
      identity.resolution_status as (typeof histIdentities.$inferInsert)["resolutionStatus"],
    resolutionDate: identity.resolution_date ?? null,
    resolutionNote: identity.resolution_note ?? null,
  }));

  const sourceLabelRows = BUNDLE.identityMap.identities.flatMap((identity) =>
    identity.source_labels.map((label) => ({
      batchId,
      identityCanonicalId: identity.canonical_id,
      source: label.source,
      label: label.label,
      occurrences: label.occurrences ?? null,
    })),
  );

  const factRows = BUNDLE.historicalFacts.facts.map((fact) => ({
    batchId,
    periodGranularity:
      fact.period.granularity as (typeof histFacts.$inferInsert)["periodGranularity"],
    periodYear: fact.period.year ?? null,
    periodMonth: fact.period.month ?? null,
    periodStart: fact.period.start ?? null,
    periodEnd: fact.period.end ?? null,
    identityCanonicalId: fact.identity?.canonical_id ?? null,
    source: fact.source as (typeof histFacts.$inferInsert)["source"],
    metric: fact.metric,
    value: fact.value,
    unit: fact.unit,
    confidence:
      fact.confidence as (typeof histFacts.$inferInsert)["confidence"],
    canonical: fact.canonical,
    provenance: fact.provenance,
    derivationNote: fact.derivation?.note ?? null,
  }));

  const coverageRows = BUNDLE.sourceCoverage.months.flatMap((monthEntry) =>
    (["upwork_weekly_summary", "clockify_detailed_export", "activitywatch_afk"] as const).map(
      (source) => ({
        batchId,
        year: monthEntry.year,
        month: monthEntry.month,
        source,
        status: mapCoverageStatus(monthEntry[source].status),
        note:
          typeof monthEntry[source].note === "string"
            ? (monthEntry[source].note as string)
            : null,
      }),
    ),
  );

  const statements = [
    ...chunk(identityRows, INSERT_CHUNK_SIZE).map((rows) =>
      db.insert(histIdentities).values(rows),
    ),
    ...chunk(sourceLabelRows, INSERT_CHUNK_SIZE).map((rows) =>
      db.insert(histIdentitySourceLabels).values(rows),
    ),
    ...chunk(factRows, INSERT_CHUNK_SIZE).map((rows) =>
      db.insert(histFacts).values(rows),
    ),
    ...chunk(coverageRows, INSERT_CHUNK_SIZE).map((rows) =>
      db.insert(histSourceCoverage).values(rows),
    ),
    db
      .update(histImportBatches)
      .set({ status: "SUPERSEDED", supersededAt: new Date() })
      .where(
        and(
          eq(histImportBatches.status, "ACTIVE"),
        ),
      ),
    db
      .update(histImportBatches)
      .set({ status: "ACTIVE" })
      .where(eq(histImportBatches.id, batchId)),
  ] as const;

  // db.batch requires a non-empty tuple with at least one statement; the two
  // status-transition updates guarantee that even if every row array above
  // is empty (which validation would already have rejected upstream).
  await db.batch(
    statements as unknown as [
      (typeof statements)[number],
      ...(typeof statements)[number][],
    ],
  );

  revalidatePath("/all-history");

  return {
    success: true,
    skipped: false,
    batchId,
    message: `Imported ${factRows.length} facts, ${identityRows.length} identities, ${coverageRows.length} coverage rows into batch ${batchId} and activated it.`,
  };
}
