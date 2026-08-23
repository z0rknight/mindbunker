#!/usr/bin/env node
// scripts/local-only-import-historical.mjs
//
// LOCAL-ONLY QA TOOL — Sprint 1.2 P0 / 1.2.1 dogfooding prep.
// Not part of the deployed MindBunker application: lives outside src/,
// is not imported by any route or component, and next build / opennextjs
// build do not touch this file.
//
// WHAT THIS IS
// It runs the same import that src/modules/historical/actions.ts exposes as
// the Server Action `importHistoricalArtifact()` -- same validation, same
// fingerprint-based idempotency, same batched inserts -- but from a bare
// Node process instead of from an authenticated request inside the running
// Next.js app. That's unavoidable: `importHistoricalArtifact()` calls
// requireAuth() (next/headers), which only works inside a real Next.js
// request. This script exists so you have an exact, safe, local-only way to
// run the import without wiring a UI button into the product for it.
//
// It talks to the SAME local D1 database that `next dev`
// (via initOpenNextCloudflareForDev()) and `wrangler d1 migrations apply
// --local` use -- via wrangler's own getPlatformProxy() API, the officially
// supported way to reach local bindings from a plain script. It does NOT
// touch remote/production D1: getPlatformProxy() defaults to the local
// Miniflare-backed database under .wrangler/state.
//
// KEEP IN SYNC: the row-building logic below is a deliberate, minimal copy
// of importHistoricalArtifact()'s body (validation + fingerprint + coverage
// mapping are imported directly from core.ts and are NOT duplicated; only
// the Drizzle row-shaping and the db.batch() call are). If you change
// src/modules/historical/actions.ts, check this file still matches before
// trusting it again.
//
// USAGE (repo root, local D1 only):
//   bun run db:migrate:local              # make sure migration 0012 is applied locally
//   node scripts/local-only-import-historical.mjs
//
// Safe to run more than once: the same fingerprint-based idempotency as the
// real action applies here (a second run reports skipped, no writes).

import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import {
  computeHistArtifactFingerprint,
  mapCoverageStatus,
  validateHistArtifactBundle,
} from "../src/modules/historical/core.ts";
import manifestJson from "../src/modules/historical/artifact/v0_1_0/manifest_v0.json" with { type: "json" };
import historicalFactsJson from "../src/modules/historical/artifact/v0_1_0/historical_facts_v0.json" with { type: "json" };
import identityMapJson from "../src/modules/historical/artifact/v0_1_0/identity_map_v0.json" with { type: "json" };
import sourceCoverageJson from "../src/modules/historical/artifact/v0_1_0/source_coverage_v0.json" with { type: "json" };

const INSERT_CHUNK_SIZE = 40;

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const BUNDLE = {
  manifest: manifestJson,
  historicalFacts: historicalFactsJson,
  identityMap: identityMapJson,
  sourceCoverage: sourceCoverageJson,
};

async function main() {
  const validation = validateHistArtifactBundle(BUNDLE);
  if (!validation.valid) {
    console.error("Embedded artifact failed contract validation:");
    for (const error of validation.errors) console.error(" -", error);
    process.exitCode = 1;
    return;
  }

  const fingerprint = await computeHistArtifactFingerprint(BUNDLE);

  const proxy = await getPlatformProxy({
    configPath: new URL("../wrangler.jsonc", import.meta.url).pathname,
  });
  const { histFacts, histIdentities, histIdentitySourceLabels, histImportBatches, histSourceCoverage } = schema;

  try {
    const db = drizzle(proxy.env.DB, { schema });

    const existing = await db
      .select({ id: histImportBatches.id, status: histImportBatches.status })
      .from(histImportBatches)
      .where(eq(histImportBatches.fingerprint, fingerprint))
      .limit(1);

    let batchId;
    if (existing[0]) {
      if (existing[0].status === "ACTIVE" || existing[0].status === "SUPERSEDED") {
        console.log(
          `Skipped: this exact artifact content already exists as batch ${existing[0].id} (${existing[0].status}). No changes made.`,
        );
        return;
      }
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
      batchId = inserted[0].id;
    }

    const identityRows = BUNDLE.identityMap.identities.map((identity) => ({
      batchId,
      canonicalId: identity.canonical_id,
      canonicalLabel: identity.canonical_label,
      identityType: identity.identity_type,
      resolutionStatus: identity.resolution_status,
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
      periodGranularity: fact.period.granularity,
      periodYear: fact.period.year ?? null,
      periodMonth: fact.period.month ?? null,
      periodStart: fact.period.start ?? null,
      periodEnd: fact.period.end ?? null,
      identityCanonicalId: fact.identity?.canonical_id ?? null,
      source: fact.source,
      metric: fact.metric,
      value: fact.value,
      unit: fact.unit,
      confidence: fact.confidence,
      canonical: fact.canonical,
      provenance: fact.provenance,
      derivationNote: fact.derivation?.note ?? null,
    }));

    const coverageRows = BUNDLE.sourceCoverage.months.flatMap((monthEntry) =>
      ["upwork_weekly_summary", "clockify_detailed_export", "activitywatch_afk"].map((source) => ({
        batchId,
        year: monthEntry.year,
        month: monthEntry.month,
        source,
        status: mapCoverageStatus(monthEntry[source].status),
        note: typeof monthEntry[source].note === "string" ? monthEntry[source].note : null,
      })),
    );

    const statements = [
      ...chunk(identityRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(histIdentities).values(rows)),
      ...chunk(sourceLabelRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(histIdentitySourceLabels).values(rows)),
      ...chunk(factRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(histFacts).values(rows)),
      ...chunk(coverageRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(histSourceCoverage).values(rows)),
      db.update(histImportBatches).set({ status: "SUPERSEDED", supersededAt: new Date() }).where(and(eq(histImportBatches.status, "ACTIVE"))),
      db.update(histImportBatches).set({ status: "ACTIVE" }).where(eq(histImportBatches.id, batchId)),
    ];

    await db.batch(statements);

    console.log(
      `Imported ${factRows.length} facts, ${identityRows.length} identities, ${coverageRows.length} coverage rows into batch ${batchId} and activated it.`,
    );
    console.log("Expected: 209 facts, 47 identities, 132 coverage rows (44 months x 3 sources).");
  } finally {
    await proxy.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
