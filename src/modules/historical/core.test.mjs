import assert from "node:assert/strict";
import test from "node:test";

import {
  computeHistArtifactFingerprint,
  mapCoverageStatus,
  validateHistArtifactBundle,
} from "./core.ts";

function validBundle(overrides = {}) {
  return {
    manifest: { contract_version: "0.1.0", generated_date: "2026-08-22" },
    historicalFacts: {
      contract_version: "0.1.0",
      generated_date: "2026-08-22",
      facts: [
        {
          period: { granularity: "month", year: 2025, month: 5 },
          identity: null,
          source: "upwork_weekly_summary",
          metric: "revenue",
          value: 100,
          unit: "usd",
          confidence: "HIGH",
          canonical: true,
          provenance: "test",
          derivation: { version: "0.1.0", generated_date: "2026-08-22" },
        },
      ],
    },
    identityMap: {
      contract_version: "0.1.0",
      generated_date: "2026-08-22",
      identities: [
        {
          canonical_id: "client:sean_go",
          canonical_label: "Sean Go",
          identity_type: "client",
          resolution_status: "HUMAN_CONFIRMED",
          source_labels: [],
        },
      ],
    },
    sourceCoverage: {
      contract_version: "0.1.0",
      generated_date: "2026-08-22",
      window: { start: "2023-01", end: "2026-08" },
      sources: ["upwork_weekly_summary", "clockify_detailed_export", "activitywatch_afk"],
      months: [
        {
          year: 2025,
          month: 5,
          upwork_weekly_summary: { status: "DATA PRESENT" },
          clockify_detailed_export: { status: "UNKNOWN / NO SOURCE DATA" },
          activitywatch_afk: { status: "UNKNOWN / NO SOURCE DATA" },
        },
      ],
    },
    ...overrides,
  };
}

test("a well-formed bundle at the supported contract version validates", () => {
  const result = validateHistArtifactBundle(validBundle());
  assert.equal(result.valid, true);
});

test("an unsupported contract_version is rejected", () => {
  const bundle = validBundle();
  bundle.manifest = { ...bundle.manifest, contract_version: "0.2.0" };
  const result = validateHistArtifactBundle(bundle);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((e) => e.includes("contract_version")));
  }
});

test("hard rule 1: an EXPERIMENTAL fact must be canonical:false", () => {
  const bundle = validBundle();
  bundle.historicalFacts.facts.push({
    period: { granularity: "window", start: "2025-11-02", end: "2026-08-22" },
    identity: null,
    source: "activitywatch_afk",
    metric: "experimental_merged_not_afk_hours",
    value: 100,
    unit: "hours",
    confidence: "EXPERIMENTAL",
    canonical: true, // violation: should be false
    provenance: "test",
    derivation: { version: "0.1.0", generated_date: "2026-08-22" },
  });
  const result = validateHistArtifactBundle(bundle);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((e) => e.includes("hard rule 1")));
  }
});

test("hard rule 2: tracked_hours_upper_bound must be canonical:false", () => {
  const bundle = validBundle();
  bundle.historicalFacts.facts.push({
    period: { granularity: "lifetime" },
    identity: {
      canonical_id: "client:sean_go",
      canonical_label: "Sean Go",
      identity_type: "client",
      resolution_status: "HUMAN_CONFIRMED",
    },
    source: "clockify_detailed_export",
    metric: "tracked_hours_upper_bound",
    value: 153.41,
    unit: "hours",
    confidence: "LOW",
    canonical: true, // violation: should be false
    provenance: "test",
    derivation: { version: "0.1.0", generated_date: "2026-08-22" },
  });
  const result = validateHistArtifactBundle(bundle);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((e) => e.includes("hard rule 2")));
  }
});

test("hard rule 3: effective_billed_rate must come from upwork_weekly_summary", () => {
  const bundle = validBundle();
  bundle.historicalFacts.facts.push({
    period: { granularity: "month", year: 2025, month: 5 },
    identity: null,
    source: "clockify_detailed_export", // violation: not upwork_weekly_summary
    metric: "effective_billed_rate",
    value: 25,
    unit: "usd_per_hour",
    confidence: "MEDIUM",
    canonical: true,
    provenance: "test",
    derivation: { version: "0.1.0", generated_date: "2026-08-22" },
  });
  const result = validateHistArtifactBundle(bundle);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((e) => e.includes("hard rule 3")));
  }
});

test("an invalid coverage status string is rejected", () => {
  const bundle = validBundle();
  bundle.sourceCoverage.months[0].upwork_weekly_summary = { status: "MAYBE" };
  const result = validateHistArtifactBundle(bundle);
  assert.equal(result.valid, false);
});

test("fingerprint is deterministic for identical content and changes on any edit", async () => {
  const a = await computeHistArtifactFingerprint(validBundle());
  const b = await computeHistArtifactFingerprint(validBundle());
  assert.equal(a, b);
  assert.equal(a.length, 64); // sha256 hex

  const edited = validBundle();
  edited.historicalFacts.facts[0].value = 999;
  const c = await computeHistArtifactFingerprint(edited);
  assert.notEqual(a, c);
});

test("coverage status mapping preserves semantics with DB-safe enum values", () => {
  assert.equal(mapCoverageStatus("DATA PRESENT"), "DATA_PRESENT");
  assert.equal(
    mapCoverageStatus("UNKNOWN / NO SOURCE DATA"),
    "UNKNOWN_NO_SOURCE_DATA",
  );
});
