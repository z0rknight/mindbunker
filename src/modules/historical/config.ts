// Sprint 1.2 P0 — Historical Reference Layer configuration.
//
// This module imports Tier-1 historical reconstructed evidence (see
// src/modules/historical/artifact/v0_1_0/ARTIFACT_CONTRACT.md) into the
// hist_* tables. It never creates or touches Client/Project/Video/WorkSession
// rows. See ARTIFACT_CONTRACT.md's "Hard rules for any future importer"
// before changing anything here.

export const SUPPORTED_ARTIFACT_CONTRACT_VERSION = "0.1.0";

export const HIST_ARTIFACT_SOURCES = [
  "upwork_weekly_summary",
  "upwork_lifetime_billings",
  "clockify_detailed_export",
  "activitywatch_afk",
] as const;

export type HistArtifactSource = (typeof HIST_ARTIFACT_SOURCES)[number];

export const HIST_COVERAGE_SOURCES = [
  "upwork_weekly_summary",
  "clockify_detailed_export",
  "activitywatch_afk",
] as const;

export type HistCoverageSource = (typeof HIST_COVERAGE_SOURCES)[number];

export const HIST_CONFIDENCE_LEVELS = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "N/A",
  "EXPERIMENTAL",
] as const;

export type HistConfidenceLevel = (typeof HIST_CONFIDENCE_LEVELS)[number];

export const HIST_IDENTITY_TYPES = [
  "client",
  "internal_category",
  "unresolved_clockify_label",
  "extraction_artifact",
] as const;

export type HistIdentityType = (typeof HIST_IDENTITY_TYPES)[number];

export const HIST_RESOLUTION_STATUSES = [
  "HUMAN_CONFIRMED",
  "SINGLE_SOURCE_ONLY",
  "INTERNAL",
  "NOT_AN_IDENTITY",
] as const;

export type HistResolutionStatus = (typeof HIST_RESOLUTION_STATUSES)[number];

export const HIST_PERIOD_GRANULARITIES = [
  "month",
  "year",
  "lifetime",
  "window",
] as const;

export type HistPeriodGranularity = (typeof HIST_PERIOD_GRANULARITIES)[number];

export const HIST_BATCH_STATUSES = ["PENDING", "ACTIVE", "SUPERSEDED"] as const;

export type HistBatchStatus = (typeof HIST_BATCH_STATUSES)[number];

// All History page covers this fixed year range per the Sprint 1.2 P0 brief.
export const ALL_HISTORY_YEARS = [2023, 2024, 2025, 2026] as const;

export const HIST_COVERAGE_STATUS_LABELS: Record<string, string> = {
  DATA_PRESENT: "DATA PRESENT",
  UNKNOWN_NO_SOURCE_DATA: "UNKNOWN / NO SOURCE DATA",
};
