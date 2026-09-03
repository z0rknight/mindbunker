import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssetCode,
  computeAttentionItems,
  computeInvestmentByDomain,
  computeInvestmentSummary,
  computeMaintenanceCommandSummary,
  computeMaintenanceStatus,
  computeRecordedTco,
  computeSystemAttentionSummary,
  computeSystemFinancials,
  computeSystemInvestedCost,
  daysUntilIsoDate,
  isAcquisitionStageTransitionAllowed,
  isHighReplacementExposureContext,
  matchesEquipmentSearch,
  mostRecentMaintenanceEvent,
  rankAcquisitions,
  selectCountableAssets,
  summarizeSystemConditions,
  validateEquipmentAcquisitionInput,
  validateEquipmentAssetInput,
  validateEquipmentMaintenanceInput,
  validateEquipmentSystemInput,
  wouldCreateParentCycle,
} from "./core.ts";

test("buildAssetCode is deterministic and readable, seeded from the row id", () => {
  assert.equal(buildAssetCode("RMEDIA", "COMPUTE", 42), "RM-COMP-000042");
  assert.equal(buildAssetCode("PERSONAL", "VIDEO", 3), "PER-VID-000003");
  assert.equal(buildAssetCode("THIRD_PARTY", "NETWORK", 1), "3RD-NET-000001");
});

test("validateEquipmentAssetInput requires only Name/Ownership/Domain/Category", () => {
  const minimal = { name: "Mac mini", ownership: "RMEDIA", domain: "COMPUTE", category: "Workstation" };
  assert.equal(validateEquipmentAssetInput(minimal), null);
});

test("validateEquipmentAssetInput rejects missing name", () => {
  const bad = { name: "  ", ownership: "RMEDIA", domain: "COMPUTE", category: "Workstation" };
  assert.match(validateEquipmentAssetInput(bad) ?? "", /Name/u);
});

test("validateEquipmentAssetInput rejects unrecognized ownership/domain", () => {
  const badOwnership = { name: "X", ownership: "COMPANY", domain: "COMPUTE", category: "Workstation" };
  assert.match(validateEquipmentAssetInput(badOwnership) ?? "", /Ownership/u);
  const badDomain = { name: "X", ownership: "RMEDIA", domain: "SPACESHIP", category: "Workstation" };
  assert.match(validateEquipmentAssetInput(badDomain) ?? "", /Domain/u);
});

test("validateEquipmentAssetInput rejects negative money fields", () => {
  const base = { name: "X", ownership: "RMEDIA", domain: "COMPUTE", category: "Workstation" };
  assert.match(validateEquipmentAssetInput({ ...base, purchasePrice: -1 }) ?? "", /Purchase price/u);
  assert.match(validateEquipmentAssetInput({ ...base, currentValue: -1 }) ?? "", /Current value/u);
  assert.match(validateEquipmentAssetInput({ ...base, replacementCost: -1 }) ?? "", /Replacement cost/u);
});

test("validateEquipmentAssetInput accepts null money fields (missing is not zero)", () => {
  const base = { name: "X", ownership: "RMEDIA", domain: "COMPUTE", category: "Workstation", purchasePrice: null, currentValue: null, replacementCost: null };
  assert.equal(validateEquipmentAssetInput(base), null);
});

test("validateEquipmentAssetInput rejects malformed dates", () => {
  const base = { name: "X", ownership: "RMEDIA", domain: "COMPUTE", category: "Workstation" };
  assert.match(validateEquipmentAssetInput({ ...base, purchaseDate: "not-a-date" }) ?? "", /date/u);
  assert.match(validateEquipmentAssetInput({ ...base, warrantyUntil: "2026-13-40" }) ?? "", /date/u);
  assert.equal(validateEquipmentAssetInput({ ...base, purchaseDate: "2026-08-31" }), null);
});

test("validateEquipmentSystemInput requires Name and Ownership", () => {
  assert.equal(validateEquipmentSystemInput({ name: "RMedia NAS", ownership: "RMEDIA" }), null);
  assert.match(validateEquipmentSystemInput({ name: "", ownership: "RMEDIA" }) ?? "", /Name/u);
  assert.match(validateEquipmentSystemInput({ name: "X", ownership: "NOPE" }) ?? "", /Ownership/u);
});

// ─── Aggregation / anti-double-count fixtures ─────────────────────────
//
// A "RMedia NAS" system: the NAS itself (id 1, priced as a whole unit)
// contains a Case (id 2, no separate price -- physically inside id 1),
// a Motherboard (id 3, no separate price) and two HDDs (id 4, 5 -- each
// separately priced because they were bought and can be replaced
// independently of the NAS chassis).
const nasSystemId = 100;
const nasFixture = [
  { id: 1, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: 2000, currentValue: 1800, replacementCost: 2200 },
  { id: 2, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: 1, status: "ACTIVE", condition: "GOOD", purchasePrice: null, currentValue: null, replacementCost: null },
  { id: 3, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: 1, status: "ACTIVE", condition: "GOOD", purchasePrice: null, currentValue: null, replacementCost: null },
  { id: 4, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: 1, status: "ACTIVE", condition: "GOOD", purchasePrice: 600, currentValue: 500, replacementCost: 650 },
  { id: 5, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: 1, status: "ATTENTION" === "ATTENTION" ? "ACTIVE" : "ACTIVE", condition: "ATTENTION", purchasePrice: 600, currentValue: 400, replacementCost: 650 },
];

test("selectCountableAssets excludes a component whose parent is in the same list", () => {
  const countable = selectCountableAssets(nasFixture);
  const ids = countable.map((a) => a.id).sort();
  // id 1 (the NAS itself, no parent) stays countable. id 2/3 (no price
  // anyway, but structurally components) and id 4/5 (priced components
  // whose parent id 1 IS in the list) are excluded from the countable set.
  assert.deepEqual(ids, [1]);
});

test("computeInvestmentSummary does not double-count a priced NAS plus its priced drives", () => {
  const summary = computeInvestmentSummary(nasFixture);
  // Only id 1's purchasePrice (2000) counts -- NOT 2000 + 600 + 600 = 3200.
  assert.equal(summary.totalInvested.total, 2000);
  assert.equal(summary.totalInvested.countableCount, 1);
  assert.equal(summary.totalInvested.valuedCount, 1);
});

test("computeInvestmentSummary needsAttentionCount counts only ATTENTION/CRITICAL condition", () => {
  const summary = computeInvestmentSummary(nasFixture);
  assert.equal(summary.needsAttentionCount, 1); // id 5
});

test("a component whose parent is NOT in the same list is treated as top-level", () => {
  const orphanChild = [
    { id: 4, ownership: "RMEDIA", domain: "STORAGE", systemId: nasSystemId, parentAssetId: 1, status: "ACTIVE", condition: "GOOD", purchasePrice: 600, currentValue: 500, replacementCost: 650 },
  ];
  const summary = computeInvestmentSummary(orphanChild);
  assert.equal(summary.totalInvested.total, 600);
  assert.equal(summary.totalInvested.countableCount, 1);
});

test("computeInvestmentSummary coverage reflects partial valuation honestly (8/13 style)", () => {
  const mixed = [
    { id: 1, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: 1000, currentValue: 900, replacementCost: null },
    { id: 2, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: null, currentValue: null, replacementCost: null },
  ];
  const summary = computeInvestmentSummary(mixed);
  assert.equal(summary.currentValue.total, 900);
  assert.equal(summary.currentValue.valuedCount, 1);
  assert.equal(summary.currentValue.countableCount, 2); // coverage: "1/2 assets valued"
  assert.equal(summary.replacementExposure.valuedCount, 0);
  assert.equal(summary.replacementExposure.countableCount, 2);
});

test("computeInvestmentByDomain groups by each asset's own domain, not its parent's", () => {
  const mixed = [
    { id: 1, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: 1000, currentValue: null, replacementCost: null },
    { id: 2, ownership: "RMEDIA", domain: "STORAGE", systemId: null, parentAssetId: 1, status: "ACTIVE", condition: "GOOD", purchasePrice: 500, currentValue: null, replacementCost: null },
  ];
  const byDomain = computeInvestmentByDomain(mixed);
  const compute = byDomain.find((d) => d.domain === "COMPUTE");
  const storage = byDomain.find((d) => d.domain === "STORAGE");
  assert.equal(compute.coverage.total, 1000);
  // id 2's parent (id 1) is NOT in the STORAGE-only filtered list passed to
  // sumField internally per-domain-group, so within its own domain group it
  // is top-level and DOES count -- this is intentional: domain grouping is
  // its own scope, per the "always relative to the list passed in" rule.
  assert.equal(storage.coverage.total, 500);
});

test("computeSystemInvestedCost sums only that system's countable assets", () => {
  const otherSystemAsset = { id: 6, ownership: "RMEDIA", domain: "COMPUTE", systemId: 200, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: 5000, currentValue: null, replacementCost: null };
  const all = [...nasFixture, otherSystemAsset];
  const nasCost = computeSystemInvestedCost(nasSystemId, all);
  assert.equal(nasCost.total, 2000);
  const otherCost = computeSystemInvestedCost(200, all);
  assert.equal(otherCost.total, 5000);
});

// ─── Wave 2: Maintenance ───────────────────────────────────────────────

test("computeMaintenanceStatus is OVERDUE when nextInspection is before today", () => {
  assert.equal(computeMaintenanceStatus("2026-01-01", "2026-02-01"), "OVERDUE");
});

test("computeMaintenanceStatus is DUE_SOON within the deterministic window", () => {
  assert.equal(computeMaintenanceStatus("2026-02-15", "2026-02-01"), "DUE_SOON"); // 14 days out
});

test("computeMaintenanceStatus is SCHEDULED well beyond the due-soon window", () => {
  assert.equal(computeMaintenanceStatus("2026-06-01", "2026-02-01"), "SCHEDULED");
});

test("computeMaintenanceStatus is NONE when no nextInspection was ever recorded -- never treated as healthy", () => {
  assert.equal(computeMaintenanceStatus(null, "2026-02-01"), "NONE");
  assert.equal(computeMaintenanceStatus(undefined, "2026-02-01"), "NONE");
});

test("mostRecentMaintenanceEvent picks the latest performedAt, not insertion order", () => {
  const events = [
    { id: 1, performedAt: "2026-01-01", nextInspection: "2026-02-01" },
    { id: 2, performedAt: "2026-03-01", nextInspection: "2026-09-01" },
    { id: 3, performedAt: "2026-02-01", nextInspection: "2026-05-01" },
  ];
  const mostRecent = mostRecentMaintenanceEvent(events);
  assert.equal(mostRecent.id, 2);
});

test("mostRecentMaintenanceEvent breaks a same-day tie by higher id (later insert)", () => {
  const events = [
    { id: 5, performedAt: "2026-01-01", nextInspection: null },
    { id: 7, performedAt: "2026-01-01", nextInspection: null },
  ];
  assert.equal(mostRecentMaintenanceEvent(events).id, 7);
});

test("mostRecentMaintenanceEvent returns null for an empty history", () => {
  assert.equal(mostRecentMaintenanceEvent([]), null);
});

test("validateEquipmentMaintenanceInput requires a recognized type and a valid performed date", () => {
  assert.equal(
    validateEquipmentMaintenanceInput({ assetId: 1, type: "NOT_A_TYPE", performedAt: "2026-01-01" }),
    "Type must be a recognized value.",
  );
  assert.equal(
    validateEquipmentMaintenanceInput({ assetId: 1, type: "REPAIR", performedAt: "not-a-date" }),
    "Performed date must be a valid date.",
  );
  assert.equal(
    validateEquipmentMaintenanceInput({ assetId: 1, type: "REPAIR", performedAt: "2026-01-01", cost: -5 }),
    "Cost must be zero or greater.",
  );
  assert.equal(
    validateEquipmentMaintenanceInput({ assetId: 1, type: "REPAIR", performedAt: "2026-01-01" }),
    null,
  );
});

test("computeRecordedTco is null (not zero) when purchase price is unknown", () => {
  assert.equal(computeRecordedTco(null, [{ cost: 100 }]), null);
});

test("computeRecordedTco sums purchase price plus every logged cost, ignoring uncosted events", () => {
  const tco = computeRecordedTco(2000, [{ cost: 150 }, { cost: null }, { cost: 300 }]);
  assert.equal(tco.total, 2450);
  assert.equal(tco.purchasePrice, 2000);
  assert.equal(tco.maintenanceCost, 450);
  assert.equal(tco.maintenanceCostCount, 2);
});

test("computeRecordedTco with no maintenance history at all is just the purchase price", () => {
  const tco = computeRecordedTco(2000, []);
  assert.equal(tco.total, 2000);
  assert.equal(tco.maintenanceCost, 0);
  assert.equal(tco.maintenanceCostCount, 0);
});

// ─── Wave 2: Command Center attention (broadened) ──────────────────────

test("computeAttentionItems ranks CRITICAL condition above ATTENTION above DUE_SOON", () => {
  const assets = [
    { id: 1, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: null, currentValue: null, replacementCost: null },
    { id: 2, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "ATTENTION", purchasePrice: null, currentValue: null, replacementCost: null },
    { id: 3, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "CRITICAL", purchasePrice: null, currentValue: null, replacementCost: null },
  ];
  const maintenanceStatus = new Map([[1, "DUE_SOON"], [2, "NONE"], [3, "NONE"]]);
  const warranty = new Map();
  const items = computeAttentionItems(assets, maintenanceStatus, warranty, "2026-02-01");
  assert.deepEqual(items.map((i) => i.assetId), [3, 2, 1]);
  assert.deepEqual(items.map((i) => i.severity), ["CRITICAL", "ATTENTION", "DUE_SOON"]);
});

test("computeAttentionItems lists every reason an asset is flagged, not just one", () => {
  const assets = [
    { id: 1, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "ATTENTION", purchasePrice: null, currentValue: null, replacementCost: null },
  ];
  const maintenanceStatus = new Map([[1, "OVERDUE"]]);
  const warranty = new Map([[1, "2025-01-01"]]);
  const items = computeAttentionItems(assets, maintenanceStatus, warranty, "2026-02-01");
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].reasons.sort(), ["Condition: Attention", "Maintenance overdue", "Warranty expired"].sort());
  // Worst reason (overdue maintenance / ATTENTION-tier) wins the severity, not the DUE_SOON-tier warranty reason.
  assert.equal(items[0].severity, "ATTENTION");
});

test("computeAttentionItems never flags a fully healthy, on-schedule asset", () => {
  const assets = [
    { id: 1, ownership: "RMEDIA", domain: "COMPUTE", systemId: null, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: null, currentValue: null, replacementCost: null },
  ];
  const maintenanceStatus = new Map([[1, "SCHEDULED"]]);
  const warranty = new Map([[1, "2030-01-01"]]);
  const items = computeAttentionItems(assets, maintenanceStatus, warranty, "2026-02-01");
  assert.equal(items.length, 0);
});

// ─── Wave 2: Acquisitions ──────────────────────────────────────────────

test("validateEquipmentAcquisitionInput requires name and problem", () => {
  assert.equal(validateEquipmentAcquisitionInput({ name: "", problem: "x" }), "Name is required.");
  assert.equal(
    validateEquipmentAcquisitionInput({ name: "New NAS", problem: "" }),
    "Problem is required -- what does this solve?",
  );
  assert.equal(validateEquipmentAcquisitionInput({ name: "New NAS", problem: "Out of storage" }), null);
});

test("validateEquipmentAcquisitionInput rejects unrecognized stage/priority/domain", () => {
  assert.equal(
    validateEquipmentAcquisitionInput({ name: "x", problem: "y", stage: "MAYBE" }),
    "Stage must be a recognized value.",
  );
  assert.equal(
    validateEquipmentAcquisitionInput({ name: "x", problem: "y", priority: "URGENT" }),
    "Priority must be a recognized value.",
  );
  assert.equal(
    validateEquipmentAcquisitionInput({ name: "x", problem: "y", domain: "SPACE" }),
    "Domain must be a recognized value.",
  );
});

test("validateEquipmentAcquisitionInput rejects a negative estimated cost", () => {
  assert.equal(
    validateEquipmentAcquisitionInput({ name: "x", problem: "y", estimatedCost: -1 }),
    "Estimated cost must be zero or greater.",
  );
});

test("isAcquisitionStageTransitionAllowed blocks any change out of a terminal stage", () => {
  assert.equal(isAcquisitionStageTransitionAllowed("DEPLOYED", "RECEIVED"), false);
  assert.equal(isAcquisitionStageTransitionAllowed("CANCELLED", "IDEA"), false);
  assert.equal(isAcquisitionStageTransitionAllowed("DEPLOYED", "DEPLOYED"), true); // no-op is fine
});

test("isAcquisitionStageTransitionAllowed allows normal forward/backward movement outside terminal stages", () => {
  assert.equal(isAcquisitionStageTransitionAllowed("IDEA", "RESEARCH"), true);
  assert.equal(isAcquisitionStageTransitionAllowed("BUDGETED", "APPROVED"), true);
  assert.equal(isAcquisitionStageTransitionAllowed("RECEIVED", "DEPLOYED"), true);
});

test("rankAcquisitions orders by priority, then requiredBy, then age -- no invented scoring", () => {
  const acquisitions = [
    { id: 1, priority: "LOW", requiredBy: null, stage: "IDEA", createdAt: "2026-01-01" },
    { id: 2, priority: "CRITICAL", requiredBy: "2026-06-01", stage: "IDEA", createdAt: "2026-01-01" },
    { id: 3, priority: "CRITICAL", requiredBy: "2026-03-01", stage: "IDEA", createdAt: "2026-01-01" },
    { id: 4, priority: "HIGH", requiredBy: null, stage: "IDEA", createdAt: "2025-01-01" },
  ];
  const ranked = rankAcquisitions(acquisitions);
  assert.deepEqual(ranked.map((a) => a.id), [3, 2, 4, 1]);
});

// ─── Wave 2: Systems composition ───────────────────────────────────────

const systemFixture = [
  { id: 1, ownership: "RMEDIA", domain: "STORAGE", systemId: 10, parentAssetId: null, status: "ACTIVE", condition: "GOOD", purchasePrice: 2000, currentValue: 1500, replacementCost: 2200 },
  { id: 2, ownership: "RMEDIA", domain: "STORAGE", systemId: 10, parentAssetId: 1, status: "ACTIVE", condition: "ATTENTION", purchasePrice: 600, currentValue: null, replacementCost: 650 },
];

test("computeSystemFinancials applies the same anti-double-count rule to all three totals", () => {
  const financials = computeSystemFinancials(10, systemFixture);
  assert.equal(financials.invested.total, 2000); // not 2600
  assert.equal(financials.currentValue.total, 1500);
  assert.equal(financials.replacementExposure.total, 2200); // not 2850
});

test("summarizeSystemConditions surfaces the worst condition and the full count breakdown", () => {
  const summary = summarizeSystemConditions(10, systemFixture);
  assert.equal(summary.worst, "ATTENTION");
  assert.equal(summary.counts.ATTENTION, 1);
  assert.equal(summary.counts.GOOD, 1);
  assert.equal(summary.counts.CRITICAL, 0);
});

test("summarizeSystemConditions on a system with no members has no worst condition", () => {
  const summary = summarizeSystemConditions(999, systemFixture);
  assert.equal(summary.worst, null);
});

// ─── Wave 2: Parent-cycle prevention ────────────────────────────────────

test("wouldCreateParentCycle rejects an asset naming itself as its own parent", () => {
  assert.equal(wouldCreateParentCycle(1, 1, [{ id: 1, parentAssetId: null }]), true);
});

test("wouldCreateParentCycle rejects a transitive cycle (A -> B -> A)", () => {
  const allAssets = [
    { id: 1, parentAssetId: null },
    { id: 2, parentAssetId: 1 },
  ];
  // Proposing that 1's parent become 2 would close the loop 1 -> 2 -> 1.
  assert.equal(wouldCreateParentCycle(1, 2, allAssets), true);
});

test("wouldCreateParentCycle allows a normal, acyclic parent assignment", () => {
  const allAssets = [
    { id: 1, parentAssetId: null },
    { id: 2, parentAssetId: null },
    { id: 3, parentAssetId: 1 },
  ];
  assert.equal(wouldCreateParentCycle(2, 1, allAssets), false);
});

test("wouldCreateParentCycle treats clearing the parent (null) as always safe", () => {
  assert.equal(wouldCreateParentCycle(1, null, []), false);
});


// ─── Wave 3: days overdue / days until due ──────────────────────────────

test("daysUntilIsoDate returns a negative count when the date is in the past", () => {
  assert.equal(daysUntilIsoDate("2026-08-20", "2026-08-24"), -4);
});

test("daysUntilIsoDate returns a positive count when the date is upcoming", () => {
  assert.equal(daysUntilIsoDate("2026-09-03", "2026-08-24"), 10);
});

test("daysUntilIsoDate returns zero when the date is today", () => {
  assert.equal(daysUntilIsoDate("2026-08-24", "2026-08-24"), 0);
});

// ─── Wave 3: Maintenance command summary ────────────────────────────────

test("computeMaintenanceCommandSummary counts overdue/due-soon from the status map, not from events directly", () => {
  const statusByAssetId = new Map([
    [1, "OVERDUE"],
    [2, "OVERDUE"],
    [3, "DUE_SOON"],
    [4, "SCHEDULED"],
    [5, "NONE"],
  ]);
  const summary = computeMaintenanceCommandSummary(statusByAssetId, [], "2026-08-24");
  assert.equal(summary.overdueCount, 2);
  assert.equal(summary.dueSoonCount, 1);
});

test("computeMaintenanceCommandSummary sums only costed events within the trailing 365-day window", () => {
  const events = [
    { performedAt: "2026-08-01", cost: 100 }, // inside window
    { performedAt: "2025-09-01", cost: 50 },  // inside window (within 365 days of 2026-08-24)
    { performedAt: "2025-01-01", cost: 999 }, // outside window
    { performedAt: "2026-07-01", cost: null }, // inside window, but uncosted -- excluded from cost, counted as an event
  ];
  const summary = computeMaintenanceCommandSummary(new Map(), events, "2026-08-24");
  assert.equal(summary.recentCost, 150);
  assert.equal(summary.recentEventCount, 3);
});

test("computeMaintenanceCommandSummary with no events and no statuses is all zeros, not null", () => {
  const summary = computeMaintenanceCommandSummary(new Map(), [], "2026-08-24");
  assert.deepEqual(summary, { overdueCount: 0, dueSoonCount: 0, recentCost: 0, recentEventCount: 0 });
});

// ─── Wave 3: Replacement exposure context ───────────────────────────────

test("isHighReplacementExposureContext is true only when cost + criticality + condition all independently qualify", () => {
  assert.equal(
    isHighReplacementExposureContext({ replacementCost: 5000, criticality: "CRITICAL", condition: "ATTENTION" }),
    true,
  );
  assert.equal(
    isHighReplacementExposureContext({ replacementCost: 5000, criticality: "PRODUCTION", condition: "CRITICAL" }),
    true,
  );
});

test("isHighReplacementExposureContext is false when replacement cost is unknown -- never treated as zero exposure or high exposure", () => {
  assert.equal(
    isHighReplacementExposureContext({ replacementCost: null, criticality: "CRITICAL", condition: "CRITICAL" }),
    false,
  );
});

test("isHighReplacementExposureContext is false when criticality is merely CONVENIENCE", () => {
  assert.equal(
    isHighReplacementExposureContext({ replacementCost: 5000, criticality: "CONVENIENCE", condition: "CRITICAL" }),
    false,
  );
});

test("isHighReplacementExposureContext is false when condition is still GOOD", () => {
  assert.equal(
    isHighReplacementExposureContext({ replacementCost: 5000, criticality: "CRITICAL", condition: "GOOD" }),
    false,
  );
});

// ─── Wave 3: Investment by domain -- current value / replacement exposure ─

test("computeInvestmentByDomain's currentValue/replacementExposure never double-count a priced parent + priced child in the same domain", () => {
  const assets = [
    { id: 1, domain: "STORAGE", purchasePrice: 2000, currentValue: 1500, replacementCost: 2200 },
    { id: 2, domain: "STORAGE", parentAssetId: 1, purchasePrice: 600, currentValue: 400, replacementCost: 650 },
  ];
  const [domainRow] = computeInvestmentByDomain(assets);
  assert.equal(domainRow.currentValue.total, 1500); // not 1900
  assert.equal(domainRow.replacementExposure.total, 2200); // not 2850
});

test("computeInvestmentByDomain reports coverage counts even when nothing is priced -- missing stays missing", () => {
  const assets = [{ id: 1, domain: "COMPUTE", purchasePrice: null, currentValue: null, replacementCost: null }];
  const [domainRow] = computeInvestmentByDomain(assets);
  assert.equal(domainRow.currentValue.total, 0);
  assert.equal(domainRow.currentValue.valuedCount, 0);
  assert.equal(domainRow.currentValue.countableCount, 1);
});

// ─── Wave 3: System-level attention summary ─────────────────────────────

test("computeSystemAttentionSummary derives the worst condition and overdue/due-soon counts among members only", () => {
  const statusByAssetId = new Map([
    [1, "SCHEDULED"],
    [2, "OVERDUE"],
  ]);
  const summary = computeSystemAttentionSummary(10, systemFixture, statusByAssetId);
  assert.equal(summary.worstCondition, "ATTENTION");
  assert.equal(summary.attentionAssetCount, 1);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.dueSoonCount, 0);
});

test("computeSystemAttentionSummary on a system with no maintenance status recorded at all reports zero overdue, not unknown-as-overdue", () => {
  const summary = computeSystemAttentionSummary(10, systemFixture, new Map());
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.dueSoonCount, 0);
});

test("computeSystemAttentionSummary on an empty system has no worst condition and no counts", () => {
  const summary = computeSystemAttentionSummary(999, systemFixture, new Map());
  assert.equal(summary.worstCondition, null);
  assert.equal(summary.attentionAssetCount, 0);
});

// ─── Wave 3: Registry search ─────────────────────────────────────────────

const searchAsset = {
  name: "RMedia NAS",
  assetCode: "RM-STOR-000042",
  serialNumber: "SN-9981",
  category: "Storage Array",
};

test("matchesEquipmentSearch matches on name, asset code, serial number, and category, case-insensitively", () => {
  assert.equal(matchesEquipmentSearch(searchAsset, null, "nas"), true);
  assert.equal(matchesEquipmentSearch(searchAsset, null, "RM-STOR"), true);
  assert.equal(matchesEquipmentSearch(searchAsset, null, "9981"), true);
  assert.equal(matchesEquipmentSearch(searchAsset, null, "storage array"), true);
});

test("matchesEquipmentSearch matches on the asset's system name when provided", () => {
  assert.equal(matchesEquipmentSearch(searchAsset, "RMedia Editing Suite", "editing"), true);
  assert.equal(matchesEquipmentSearch(searchAsset, "RMedia Editing Suite", "nonexistent"), false);
});

test("matchesEquipmentSearch treats a blank query as matching everything", () => {
  assert.equal(matchesEquipmentSearch(searchAsset, null, ""), true);
  assert.equal(matchesEquipmentSearch(searchAsset, null, "   "), true);
});

test("matchesEquipmentSearch does not match a null serial number as a literal string", () => {
  const asset = { ...searchAsset, serialNumber: null };
  assert.equal(matchesEquipmentSearch(asset, null, "null"), false);
});
