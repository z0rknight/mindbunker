import "server-only";

import { getAuthenticatedDb } from "@/db";
import { histFacts, histImportBatches, histSourceCoverage } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ALL_HISTORY_YEARS, HIST_COVERAGE_SOURCES } from "./config.ts";

export type HistActiveBatch = {
  id: number;
  artifactVersion: string;
  importedAt: string;
  factCount: number;
  identityCount: number;
  coverageMonthCount: number;
};

export async function getActiveHistBatch(): Promise<HistActiveBatch | null> {
  const db = await getAuthenticatedDb();
  const rows = await db
    .select({
      id: histImportBatches.id,
      artifactVersion: histImportBatches.artifactVersion,
      importedAt: histImportBatches.importedAt,
      factCount: histImportBatches.factCount,
      identityCount: histImportBatches.identityCount,
      coverageMonthCount: histImportBatches.coverageMonthCount,
    })
    .from(histImportBatches)
    .where(eq(histImportBatches.status, "ACTIVE"))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    artifactVersion: row.artifactVersion,
    importedAt: row.importedAt ? row.importedAt.toISOString() : "",
    factCount: row.factCount,
    identityCount: row.identityCount,
    coverageMonthCount: row.coverageMonthCount,
  };
}

export type AllHistoryYearRow = {
  year: number;
  revenueUsd: number | null;
  billedHours: number | null;
  trackedHours: number | null;
  trackedHoursMonthsKnown: number;
  trackedHoursMonthsTotal: number;
  coverage: {
    source: string;
    monthsPresent: number;
    monthsTotal: number;
  }[];
};

// The Sprint 1.2 P0 "All History" summary: one row per year, 2023-2026,
// sourced only from the ACTIVE hist_import_batches batch. Returns an empty
// array (not zeros) if no batch has been imported and activated yet -- the
// page is responsible for rendering that as "no historical data imported"
// rather than as a table of zeroes.
export async function getAllHistorySummary(): Promise<AllHistoryYearRow[]> {
  const activeBatch = await getActiveHistBatch();
  if (!activeBatch) return [];

  const db = await getAuthenticatedDb();
  const batchId = activeBatch.id;

  const [yearlyUpworkFacts, monthlyClockifyFacts, coverageRows] =
    await Promise.all([
      db
        .select({
          year: histFacts.periodYear,
          metric: histFacts.metric,
          value: histFacts.value,
        })
        .from(histFacts)
        .where(
          and(
            eq(histFacts.batchId, batchId),
            eq(histFacts.periodGranularity, "year"),
            eq(histFacts.source, "upwork_weekly_summary"),
          ),
        ),
      db
        .select({
          year: histFacts.periodYear,
          value: histFacts.value,
        })
        .from(histFacts)
        .where(
          and(
            eq(histFacts.batchId, batchId),
            eq(histFacts.periodGranularity, "month"),
            eq(histFacts.source, "clockify_detailed_export"),
            eq(histFacts.metric, "tracked_hours"),
          ),
        ),
      db
        .select({
          year: histSourceCoverage.year,
          month: histSourceCoverage.month,
          source: histSourceCoverage.source,
          status: histSourceCoverage.status,
        })
        .from(histSourceCoverage)
        .where(eq(histSourceCoverage.batchId, batchId)),
    ]);

  return ALL_HISTORY_YEARS.map((year) => {
    const revenueFact = yearlyUpworkFacts.find(
      (f) => f.year === year && f.metric === "revenue",
    );
    const billedHoursFact = yearlyUpworkFacts.find(
      (f) => f.year === year && f.metric === "billed_hours",
    );
    const clockifyMonthsThisYear = monthlyClockifyFacts.filter(
      (f) => f.year === year,
    );
    const trackedHours =
      clockifyMonthsThisYear.length > 0
        ? clockifyMonthsThisYear.reduce((sum, f) => sum + (f.value ?? 0), 0)
        : null;

    const coverageMonthsThisYear = coverageRows.filter(
      (c) => c.year === year,
    );
    const monthsTotalThisYear = new Set(
      coverageMonthsThisYear.map((c) => c.month),
    ).size;

    const coverage = HIST_COVERAGE_SOURCES.map((source) => {
      const rowsForSource = coverageMonthsThisYear.filter(
        (c) => c.source === source,
      );
      const present = rowsForSource.filter(
        (c) => c.status === "DATA_PRESENT",
      ).length;
      return {
        source,
        monthsPresent: present,
        monthsTotal: rowsForSource.length,
      };
    });

    return {
      year,
      revenueUsd: revenueFact?.value ?? null,
      billedHours: billedHoursFact?.value ?? null,
      trackedHours,
      trackedHoursMonthsKnown: clockifyMonthsThisYear.length,
      trackedHoursMonthsTotal: monthsTotalThisYear,
      coverage,
    };
  });
}
