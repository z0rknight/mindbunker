// Sprint 1.2 P0 — Historical Reference Layer: pure validation, fingerprinting,
// and mapping logic. No DB or network access here — see data.ts/actions.ts.

import {
  HIST_ARTIFACT_SOURCES,
  HIST_CONFIDENCE_LEVELS,
  HIST_COVERAGE_SOURCES,
  HIST_IDENTITY_TYPES,
  HIST_PERIOD_GRANULARITIES,
  HIST_RESOLUTION_STATUSES,
  SUPPORTED_ARTIFACT_CONTRACT_VERSION,
  type HistArtifactSource,
  type HistConfidenceLevel,
  type HistIdentityType,
  type HistPeriodGranularity,
  type HistResolutionStatus,
} from "./config.ts";

// ─── Raw artifact shapes (as read from the embedded v0_1_0 JSON files) ────────

export type RawFactPeriod = {
  granularity: string;
  year?: number;
  month?: number;
  start?: string;
  end?: string;
};

export type RawFactIdentity = {
  canonical_id: string;
  canonical_label: string;
  identity_type: string;
  resolution_status: string;
} | null;

export type RawFact = {
  period: RawFactPeriod;
  identity: RawFactIdentity;
  source: string;
  metric: string;
  value: number | null;
  unit: string;
  confidence: string;
  canonical: boolean;
  provenance: string;
  derivation: { version: string; generated_date: string; note?: string };
};

export type RawHistoricalFactsArtifact = {
  contract_version: string;
  generated_date: string;
  facts: RawFact[];
};

export type RawIdentitySourceLabel = {
  source: string;
  label: string;
  occurrences?: number;
};

export type RawIdentity = {
  canonical_id: string;
  canonical_label: string;
  identity_type: string;
  resolution_status: string;
  resolution_date?: string;
  resolution_note?: string;
  source_labels: RawIdentitySourceLabel[];
};

export type RawIdentityMapArtifact = {
  contract_version: string;
  generated_date: string;
  identities: RawIdentity[];
};

export type RawCoverageSourceEntry = {
  status: string;
  [key: string]: unknown;
};

export type RawCoverageMonth = {
  year: number;
  month: number;
  upwork_weekly_summary: RawCoverageSourceEntry;
  clockify_detailed_export: RawCoverageSourceEntry;
  activitywatch_afk: RawCoverageSourceEntry;
};

export type RawSourceCoverageArtifact = {
  contract_version: string;
  generated_date: string;
  window: { start: string; end: string };
  sources: string[];
  months: RawCoverageMonth[];
};

export type RawManifestArtifact = {
  contract_version: string;
  generated_date: string;
  artifact_name: string;
  purpose: string;
  files: Record<string, string>;
  raw_file_manifest: { path: string; sha256: string; bytes: number }[];
  warnings: string[];
};

export type HistArtifactBundle = {
  manifest: RawManifestArtifact;
  historicalFacts: RawHistoricalFactsArtifact;
  identityMap: RawIdentityMapArtifact;
  sourceCoverage: RawSourceCoverageArtifact;
};

// ─── Type guards ────────────────────────────────────────────────────────────

export function isHistArtifactSource(value: string): value is HistArtifactSource {
  return (HIST_ARTIFACT_SOURCES as readonly string[]).includes(value);
}

export function isHistConfidenceLevel(
  value: string,
): value is HistConfidenceLevel {
  return (HIST_CONFIDENCE_LEVELS as readonly string[]).includes(value);
}

export function isHistIdentityType(value: string): value is HistIdentityType {
  return (HIST_IDENTITY_TYPES as readonly string[]).includes(value);
}

export function isHistResolutionStatus(
  value: string,
): value is HistResolutionStatus {
  return (HIST_RESOLUTION_STATUSES as readonly string[]).includes(value);
}

export function isHistPeriodGranularity(
  value: string,
): value is HistPeriodGranularity {
  return (HIST_PERIOD_GRANULARITIES as readonly string[]).includes(value);
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type HistValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

// Validates the bundle's internal consistency and contract compliance.
// This does NOT re-derive figures from RAW sources (that already happened
// upstream when the artifact was generated) -- it checks that the embedded
// JSON is shaped the way ARTIFACT_CONTRACT.md says it must be, and that the
// five hard rules are respected, before anything is written to the DB.
export function validateHistArtifactBundle(
  bundle: HistArtifactBundle,
): HistValidationResult {
  const errors: string[] = [];

  for (const [name, doc] of [
    ["manifest", bundle.manifest],
    ["historicalFacts", bundle.historicalFacts],
    ["identityMap", bundle.identityMap],
    ["sourceCoverage", bundle.sourceCoverage],
  ] as const) {
    if (doc.contract_version !== SUPPORTED_ARTIFACT_CONTRACT_VERSION) {
      errors.push(
        `${name}.contract_version is "${doc.contract_version}", expected "${SUPPORTED_ARTIFACT_CONTRACT_VERSION}"`,
      );
    }
  }

  for (const [i, fact] of bundle.historicalFacts.facts.entries()) {
    if (!isHistPeriodGranularity(fact.period.granularity)) {
      errors.push(`facts[${i}].period.granularity is invalid: "${fact.period.granularity}"`);
    }
    if (!isHistArtifactSource(fact.source)) {
      errors.push(`facts[${i}].source is invalid: "${fact.source}"`);
    }
    if (!isHistConfidenceLevel(fact.confidence)) {
      errors.push(`facts[${i}].confidence is invalid: "${fact.confidence}"`);
    }
    // Hard rule 1: EXPERIMENTAL/non-canonical AFK facts must never look like
    // worked/active hours. We don't have a "worked_hours" metric name in this
    // artifact version, so we just assert the canonical/confidence pairing
    // the contract promises, so a future metric addition can't silently
    // violate it.
    if (fact.confidence === "EXPERIMENTAL" && fact.canonical !== false) {
      errors.push(
        `facts[${i}] has confidence EXPERIMENTAL but canonical is not false (hard rule 1)`,
      );
    }
    // Hard rule 2: the Sean Go upper-bound fact must stay non-canonical.
    if (
      fact.metric === "tracked_hours_upper_bound" &&
      fact.canonical !== false
    ) {
      errors.push(
        `facts[${i}] is tracked_hours_upper_bound but canonical is not false (hard rule 2)`,
      );
    }
    // Hard rule 3: effective_billed_rate must stay Upwork-internal.
    if (
      fact.metric === "effective_billed_rate" &&
      fact.source !== "upwork_weekly_summary"
    ) {
      errors.push(
        `facts[${i}] is effective_billed_rate but source is "${fact.source}", not upwork_weekly_summary (hard rule 3)`,
      );
    }
  }

  for (const [i, identity] of bundle.identityMap.identities.entries()) {
    if (!isHistIdentityType(identity.identity_type)) {
      errors.push(`identities[${i}].identity_type is invalid: "${identity.identity_type}"`);
    }
    if (!isHistResolutionStatus(identity.resolution_status)) {
      errors.push(`identities[${i}].resolution_status is invalid: "${identity.resolution_status}"`);
    }
  }

  for (const [i, monthEntry] of bundle.sourceCoverage.months.entries()) {
    for (const source of HIST_COVERAGE_SOURCES) {
      const entry = monthEntry[source];
      if (!entry || (entry.status !== "DATA PRESENT" && entry.status !== "UNKNOWN / NO SOURCE DATA")) {
        errors.push(
          `sourceCoverage.months[${i}].${source}.status is invalid: "${entry?.status}"`,
        );
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// ─── Fingerprinting (idempotency) ──────────────────────────────────────────

// Deterministic fingerprint over the 4 source documents' own content, used to
// detect "this exact artifact was already imported" without re-running the
// full import. Uses the Web Crypto API (edge-compatible, same primitive the
// gateway module uses for token hashing).
export async function computeHistArtifactFingerprint(
  bundle: HistArtifactBundle,
): Promise<string> {
  const canonical = JSON.stringify({
    manifest: bundle.manifest,
    historicalFacts: bundle.historicalFacts,
    identityMap: bundle.identityMap,
    sourceCoverage: bundle.sourceCoverage,
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Mapping: coverage status string -> DB enum value ──────────────────────

export function mapCoverageStatus(
  raw: string,
): "DATA_PRESENT" | "UNKNOWN_NO_SOURCE_DATA" {
  return raw === "DATA PRESENT" ? "DATA_PRESENT" : "UNKNOWN_NO_SOURCE_DATA";
}

// ─── All History BI visuals (Monday Local Intelligence Lab §C) ────────────
//
// Pure derived-metric functions over the same AllHistoryYearRow shape
// data.ts's getAllHistorySummary() already returns -- no new DB queries, no
// new hist_* reads, nothing that touches the native/historical evidence
// boundary. Both functions honor the same hard rule the rest of this module
// already follows: a year with unknown revenue is never treated as $0.

export type AllHistoryVisualRow = {
  year: number;
  revenueUsd: number | null;
};

export type YoYRevenueEntry = { year: number; changePct: number | null };

// null whenever either side of the comparison (this year or the prior
// year) is unknown, or the prior year's revenue was exactly 0 (division by
// zero would produce a meaningless / infinite percentage) -- never
// substituted with 0 or interpolated.
export function computeYoYRevenueChange(
  rows: readonly AllHistoryVisualRow[],
): YoYRevenueEntry[] {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  return sorted.map((row, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    if (
      !prev ||
      prev.revenueUsd === null ||
      row.revenueUsd === null ||
      prev.revenueUsd === 0
    ) {
      return { year: row.year, changePct: null };
    }
    const changePct = ((row.revenueUsd - prev.revenueUsd) / prev.revenueUsd) * 100;
    return { year: row.year, changePct: Math.round(changePct * 10) / 10 };
  });
}

export type CumulativeRevenueEntry = {
  year: number;
  cumulativeUsd: number | null;
};

// Honest cumulative sum: once a year in the (year-sorted) sequence has
// unknown revenue, every year from that point on is null too -- summing
// past a gap as if the missing year contributed $0 would understate the
// true lifetime total while presenting it as complete. The result is
// always either "fully known so far" or "unknown from here on," never a
// silently-approximated running total.
export function computeCumulativeRevenue(
  rows: readonly AllHistoryVisualRow[],
): CumulativeRevenueEntry[] {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  let running = 0;
  let broken = false;
  return sorted.map((row) => {
    if (broken || row.revenueUsd === null) {
      broken = true;
      return { year: row.year, cumulativeUsd: null };
    }
    running += row.revenueUsd;
    return { year: row.year, cumulativeUsd: running };
  });
}
