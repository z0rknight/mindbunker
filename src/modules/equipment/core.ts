// Equipment Wave 1 -- pure logic only. No DB access here (that lives in
// actions.ts); everything below is unit-testable in isolation and is what
// core.test.mjs exercises directly.

import {
  EQUIPMENT_ACQUISITION_TERMINAL_STAGES,
  EQUIPMENT_ATTENTION_CONDITIONS,
  EQUIPMENT_DOMAIN_CODE,
  EQUIPMENT_MAINTENANCE_DUE_SOON_DAYS,
  EQUIPMENT_OWNERSHIP_CODE,
  isEquipmentAcquisitionPriority,
  isEquipmentAcquisitionStage,
  isEquipmentCondition,
  isEquipmentCriticality,
  isEquipmentDomain,
  isEquipmentMaintenanceType,
  isEquipmentOwnership,
  isEquipmentStatus,
  type EquipmentAcquisitionStage,
  type EquipmentCondition,
  type EquipmentDomain,
  type EquipmentOwnership,
} from "./config.ts";

// Minimal shape each pure function needs -- deliberately NOT the full
// Drizzle-inferred row type, so this file has zero dependency on
// src/db/schema.ts and stays testable with plain fixture objects.
export type EquipmentAssetRecord = {
  id: number;
  ownership: EquipmentOwnership;
  domain: EquipmentDomain;
  systemId: number | null;
  parentAssetId: number | null;
  status: string;
  condition: EquipmentCondition;
  purchasePrice: number | null;
  currentValue: number | null;
  replacementCost: number | null;
};

// ─── Asset code ────────────────────────────────────────────────────────
//
// Wave 1 brief §8 explicitly warns against a concurrency-unsafe
// "MAX(id)+1" or per-domain-counter scheme under D1 -- a second request
// racing between "count existing COMP assets" and "insert" could hand out
// the same human-readable number twice. The autoincrement primary key
// itself is the one value SQLite/D1 already guarantees unique and
// race-free (it is assigned atomically by the INSERT itself), so the
// asset code is deterministically DERIVED from that id after insert
// rather than from a separately-queried count:
//
//   {OWNERSHIP_CODE}-{DOMAIN_CODE}-{zero-padded id}
//   e.g. RM-COMP-000042, PER-VID-000003
//
// This sacrifices "resets to 001 per domain" in exchange for correctness
// under concurrent writes. It is still fully deterministic, still human
// -readable, and still sorts and reads the way the brief's own examples
// (RM-COMP-001, PER-VID-003) intend -- just seeded from the row's real id
// instead of a racy per-domain count. See Equipment Wave 1 report §8 for
// the explicit tradeoff writeup this file's comment summarizes.
export function buildAssetCode(
  ownership: EquipmentOwnership,
  domain: EquipmentDomain,
  id: number,
): string {
  const ownershipCode = EQUIPMENT_OWNERSHIP_CODE[ownership];
  const domainCode = EQUIPMENT_DOMAIN_CODE[domain];
  const padded = String(id).padStart(6, "0");
  return `${ownershipCode}-${domainCode}-${padded}`;
}

// ─── Validation ────────────────────────────────────────────────────────

export type EquipmentAssetInput = {
  name: string;
  ownership: string;
  domain: string;
  category: string;
  systemId?: number | null;
  parentAssetId?: number | null;
  location?: string | null;
  assignedTo?: string | null;
  status?: string;
  condition?: string;
  criticality?: string;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  replacementCost?: number | null;
  warrantyUntil?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value));
}

// Minimum required fields per the Wave 1 brief §8: Name, Ownership,
// Domain, Category. Everything else is optional/progressive.
export function validateEquipmentAssetInput(input: EquipmentAssetInput): string | null {
  if (!input.name || !input.name.trim()) return "Name is required.";
  if (!isEquipmentOwnership(input.ownership)) return "Ownership must be a recognized value.";
  if (!isEquipmentDomain(input.domain)) return "Domain must be a recognized value.";
  if (!input.category || !input.category.trim()) return "Category is required.";
  if (input.status !== undefined && !isEquipmentStatus(input.status)) {
    return "Status must be a recognized value.";
  }
  if (input.condition !== undefined && !isEquipmentCondition(input.condition)) {
    return "Condition must be a recognized value.";
  }
  if (input.criticality !== undefined && !isEquipmentCriticality(input.criticality)) {
    return "Criticality must be a recognized value.";
  }
  if (input.purchasePrice != null && (Number.isNaN(input.purchasePrice) || input.purchasePrice < 0)) {
    return "Purchase price must be zero or greater.";
  }
  if (input.currentValue != null && (Number.isNaN(input.currentValue) || input.currentValue < 0)) {
    return "Current value must be zero or greater.";
  }
  if (input.replacementCost != null && (Number.isNaN(input.replacementCost) || input.replacementCost < 0)) {
    return "Replacement cost must be zero or greater.";
  }
  if (input.purchaseDate && !isValidIsoDate(input.purchaseDate)) {
    return "Purchase date must be a valid date.";
  }
  if (input.warrantyUntil && !isValidIsoDate(input.warrantyUntil)) {
    return "Warranty date must be a valid date.";
  }
  return null;
}

export type EquipmentSystemInput = {
  name: string;
  ownership: string;
  description?: string | null;
  status?: string;
  location?: string | null;
};

export function validateEquipmentSystemInput(input: EquipmentSystemInput): string | null {
  if (!input.name || !input.name.trim()) return "Name is required.";
  if (!isEquipmentOwnership(input.ownership)) return "Ownership must be a recognized value.";
  if (input.status !== undefined && input.status !== "ACTIVE" && input.status !== "RESERVE" && input.status !== "RETIRED") {
    return "Status must be a recognized value.";
  }
  return null;
}

// ─── Aggregation ───────────────────────────────────────────────────────
//
// Composite anti-double-count rule (Wave 1 brief §9/§10): a component
// asset (parentAssetId set) is excluded from any money total whenever its
// parent is STILL PRESENT in the same list being summed, because the
// parent's own purchasePrice/currentValue/replacementCost is assumed to
// already cover it (e.g. "RMedia NAS" priced as a whole unit, with Case/
// Motherboard/HDD#01/HDD#02 tracked underneath it for
// identification/warranty purposes, not re-priced). An asset whose parent
// is NOT in the list being summed (deleted, or simply not passed in) is
// treated as top-level for that computation. This same "countable" filter
// is reused for the whole-registry total, a single system's total, and a
// single domain's total -- it is always relative to whatever asset list is
// passed in, which is what makes it correct at every scope without a
// separate special case per scope.
export function selectCountableAssets<T extends { id: number; parentAssetId: number | null }>(
  assets: readonly T[],
): T[] {
  const idSet = new Set(assets.map((a) => a.id));
  return assets.filter((a) => !(a.parentAssetId != null && idSet.has(a.parentAssetId)));
}

export type MoneyCoverage = {
  total: number;
  valuedCount: number;
  countableCount: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumField(
  assets: readonly EquipmentAssetRecord[],
  field: "purchasePrice" | "currentValue" | "replacementCost",
): MoneyCoverage {
  const countable = selectCountableAssets(assets);
  const valued = countable.filter((a) => a[field] != null);
  return {
    total: round2(valued.reduce((sum, a) => sum + (a[field] ?? 0), 0)),
    valuedCount: valued.length,
    countableCount: countable.length,
  };
}

export type EquipmentInvestmentSummary = {
  totalInvested: MoneyCoverage;
  currentValue: MoneyCoverage;
  replacementExposure: MoneyCoverage;
  activeCount: number;
  needsAttentionCount: number;
};

export function computeInvestmentSummary(
  assets: readonly EquipmentAssetRecord[],
): EquipmentInvestmentSummary {
  return {
    totalInvested: sumField(assets, "purchasePrice"),
    currentValue: sumField(assets, "currentValue"),
    replacementExposure: sumField(assets, "replacementCost"),
    activeCount: assets.filter((a) => a.status === "ACTIVE").length,
    needsAttentionCount: assets.filter((a) =>
      (EQUIPMENT_ATTENTION_CONDITIONS as readonly string[]).includes(a.condition),
    ).length,
  };
}

export type EquipmentDomainInvestment = {
  domain: EquipmentDomain;
  coverage: MoneyCoverage;
  // Wave 3 §9: "For each domain show: recorded invested, asset count,
  // current value coverage, replacement coverage" -- `coverage` above
  // stays the invested/purchasePrice figure (existing UI already reads
  // it under that name); these two are the added coverage-aware totals,
  // same MoneyCoverage shape as the Command Center summary so partial
  // valuation is always shown honestly, never silently defaulted.
  currentValue: MoneyCoverage;
  replacementExposure: MoneyCoverage;
  assetCount: number;
};

// Grouped strictly by each asset's own `domain` -- a component inherits no
// domain from its parent, so a STORAGE drive under a COMPUTE-domain NAS
// motherboard is counted under STORAGE, not COMPUTE. This mirrors the same
// "no inferred conversion / no borrowed classification" discipline the War
// Room's currency-isolated revenue panel already uses (see
// MINDBUNKER_MASTER_QA_LEDGER.md WAR-003).
export function computeInvestmentByDomain(
  assets: readonly EquipmentAssetRecord[],
): EquipmentDomainInvestment[] {
  const byDomain = new Map<EquipmentDomain, EquipmentAssetRecord[]>();
  for (const asset of assets) {
    const list = byDomain.get(asset.domain) ?? [];
    list.push(asset);
    byDomain.set(asset.domain, list);
  }
  return Array.from(byDomain.entries())
    .map(([domain, domainAssets]) => ({
      domain,
      coverage: sumField(domainAssets, "purchasePrice"),
      currentValue: sumField(domainAssets, "currentValue"),
      replacementExposure: sumField(domainAssets, "replacementCost"),
      assetCount: domainAssets.length,
    }))
    .sort((a, b) => b.coverage.total - a.coverage.total);
}

export type EquipmentSystemInvestment = MoneyCoverage;

export function computeSystemInvestedCost(
  systemId: number,
  assets: readonly EquipmentAssetRecord[],
): EquipmentSystemInvestment {
  const systemAssets = assets.filter((a) => a.systemId === systemId);
  return sumField(systemAssets, "purchasePrice");
}

// Wave 2 §7: a System card/detail needs more than a single invested
// total to be understandable -- current value coverage and replacement
// exposure coverage too, using the exact same anti-double-count
// `selectCountableAssets` rule as invested cost (sumField applies it
// internally), so a priced parent + priced child never inflates any of
// the three figures.
export type EquipmentSystemFinancials = {
  invested: MoneyCoverage;
  currentValue: MoneyCoverage;
  replacementExposure: MoneyCoverage;
};

export function computeSystemFinancials(
  systemId: number,
  assets: readonly EquipmentAssetRecord[],
): EquipmentSystemFinancials {
  const systemAssets = assets.filter((a) => a.systemId === systemId);
  return {
    invested: sumField(systemAssets, "purchasePrice"),
    currentValue: sumField(systemAssets, "currentValue"),
    replacementExposure: sumField(systemAssets, "replacementCost"),
  };
}

export type ConditionSummary = {
  worst: EquipmentCondition | null;
  counts: Record<EquipmentCondition, number>;
};

const CONDITION_SEVERITY: Record<EquipmentCondition, number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  GOOD: 2,
  EXCELLENT: 3,
};

// A system's "condition summary" is the worst condition among its
// members (never averaged/scored -- Wave 1's "no fake precision" rule
// extends to Wave 2's systems view) plus the full count breakdown so the
// UI can show both "worst first" and the honest distribution.
export function summarizeSystemConditions(
  systemId: number,
  assets: readonly EquipmentAssetRecord[],
): ConditionSummary {
  const systemAssets = assets.filter((a) => a.systemId === systemId);
  const counts: Record<EquipmentCondition, number> = {
    EXCELLENT: 0,
    GOOD: 0,
    ATTENTION: 0,
    CRITICAL: 0,
  };
  let worst: EquipmentCondition | null = null;
  for (const asset of systemAssets) {
    counts[asset.condition] += 1;
    if (!worst || CONDITION_SEVERITY[asset.condition] < CONDITION_SEVERITY[worst]) {
      worst = asset.condition;
    }
  }
  return { worst, counts };
}

export function assetsNeedingAttention(
  assets: readonly EquipmentAssetRecord[],
): EquipmentAssetRecord[] {
  return assets.filter((a) =>
    (EQUIPMENT_ATTENTION_CONDITIONS as readonly string[]).includes(a.condition),
  );
}

// ─── Wave 2: Maintenance ───────────────────────────────────────────────

export type EquipmentMaintenanceEventRecord = {
  id: number;
  assetId: number;
  type: string;
  performedAt: string;
  cost: number | null;
  nextInspection: string | null;
};

export type EquipmentMaintenanceInput = {
  assetId: number;
  type: string;
  performedAt: string;
  cost?: number | null;
  issue?: string | null;
  action?: string | null;
  result?: string | null;
  nextInspection?: string | null;
  notes?: string | null;
};

export function validateEquipmentMaintenanceInput(input: EquipmentMaintenanceInput): string | null {
  if (!Number.isFinite(input.assetId)) return "A valid asset is required.";
  if (!isEquipmentMaintenanceType(input.type)) return "Type must be a recognized value.";
  if (!input.performedAt || !isValidIsoDate(input.performedAt)) return "Performed date must be a valid date.";
  if (input.cost != null && (Number.isNaN(input.cost) || input.cost < 0)) {
    return "Cost must be zero or greater.";
  }
  if (input.nextInspection && !isValidIsoDate(input.nextInspection)) {
    return "Next inspection date must be a valid date.";
  }
  return null;
}

export type MaintenanceStatus = "OVERDUE" | "DUE_SOON" | "NONE" | "SCHEDULED";

// Derived strictly from recorded facts -- an asset with NO maintenance
// events at all, or with a most-recent event that set no
// nextInspection, is NONE (unknown), never treated as implicitly
// healthy (Wave 2 brief §3/§12). `today` is passed in rather than read
// from Date.now() so this stays pure and deterministically testable.
export function computeMaintenanceStatus(
  mostRecentNextInspection: string | null | undefined,
  today: string,
): MaintenanceStatus {
  if (!mostRecentNextInspection) return "NONE";
  if (mostRecentNextInspection < today) return "OVERDUE";
  const dueSoonBy = addDaysToIsoDate(today, EQUIPMENT_MAINTENANCE_DUE_SOON_DAYS);
  if (mostRecentNextInspection <= dueSoonBy) return "DUE_SOON";
  return "SCHEDULED";
}

export function addDaysToIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Wave 3 §5: "days overdue / days until due" for Asset Detail -- a
// signed day count (negative = overdue, positive = upcoming, 0 = today),
// computed by whole UTC-day difference so it's stable regardless of
// time-of-day. Deliberately just arithmetic on two recorded/derived ISO
// dates -- no prediction involved.
export function daysUntilIsoDate(iso: string, today: string): number {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  const base = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((target - base) / 86_400_000);
}

// The most recent event (by performedAt, ties broken by id) determines
// the asset's current maintenance posture -- an old event's stale
// nextInspection from 3 repairs ago should never outrank what the latest
// service actually scheduled.
export function mostRecentMaintenanceEvent<
  T extends { performedAt: string; id: number },
>(events: readonly T[]): T | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) =>
    a.performedAt === b.performedAt ? b.id - a.id : b.performedAt.localeCompare(a.performedAt),
  )[0];
}

// Recorded TCO = purchase price + the sum of every logged maintenance
// cost for that asset. Deliberately NOT a theoretical/estimated lifetime
// cost, NOT depreciation-adjusted -- Wave 2 brief §10: label it "Recorded
// TCO" and nothing stronger. Returns null (not 0) when purchasePrice
// itself is unknown, preserving the same "missing data stays missing"
// discipline as the rest of Equipment's financial semantics.
export type RecordedTco = {
  total: number;
  purchasePrice: number;
  maintenanceCost: number;
  maintenanceCostCount: number;
};

export function computeRecordedTco(
  purchasePrice: number | null,
  maintenanceEvents: readonly { cost: number | null }[],
): RecordedTco | null {
  if (purchasePrice == null) return null;
  const costed = maintenanceEvents.filter((e) => e.cost != null);
  const maintenanceCost = round2(costed.reduce((sum, e) => sum + (e.cost ?? 0), 0));
  return {
    total: round2(purchasePrice + maintenanceCost),
    purchasePrice,
    maintenanceCost,
    maintenanceCostCount: costed.length,
  };
}

// ─── Wave 3: Maintenance command summary ──────────────────────────────
//
// Wave 3 §5: "2 overdue · 1 due soon · R$450 recorded cost · 12 months"
// -- every figure here is arithmetic on facts already recorded
// (maintenance status per asset, and the last 365 days of logged event
// costs). No prediction, no failure probability, no score.
export type MaintenanceCommandSummary = {
  overdueCount: number;
  dueSoonCount: number;
  recentCost: number;
  recentEventCount: number;
};

export function computeMaintenanceCommandSummary(
  maintenanceStatusByAssetId: ReadonlyMap<number, MaintenanceStatus>,
  events: readonly { performedAt: string; cost: number | null }[],
  today: string,
): MaintenanceCommandSummary {
  let overdueCount = 0;
  let dueSoonCount = 0;
  for (const status of maintenanceStatusByAssetId.values()) {
    if (status === "OVERDUE") overdueCount += 1;
    if (status === "DUE_SOON") dueSoonCount += 1;
  }
  const windowStart = addDaysToIsoDate(today, -365);
  const recentEvents = events.filter((e) => e.performedAt >= windowStart && e.performedAt <= today);
  const costedRecent = recentEvents.filter((e) => e.cost != null);
  return {
    overdueCount,
    dueSoonCount,
    recentCost: round2(costedRecent.reduce((sum, e) => sum + (e.cost ?? 0), 0)),
    recentEventCount: recentEvents.length,
  };
}

// ─── Wave 3: Replacement / risk context ────────────────────────────────
//
// Wave 3 §6 explicitly forbids a composite "risk score" -- this is
// deliberately just three independent facts read together, surfaced as a
// label ONLY when all three plain conditions hold at once. It is not a
// numeric scale and has exactly one tier; there is no MEDIUM/LOW variant
// to invent a false sense of graduated precision.
export function isHighReplacementExposureContext(asset: {
  replacementCost: number | null;
  criticality: string;
  condition: EquipmentCondition;
}): boolean {
  return (
    asset.replacementCost != null &&
    asset.replacementCost > 0 &&
    (asset.criticality === "CRITICAL" || asset.criticality === "PRODUCTION") &&
    (asset.condition === "ATTENTION" || asset.condition === "CRITICAL")
  );
}

// ─── Wave 3: Registry search ────────────────────────────────────────────
//
// Wave 3 §10: lightweight, deterministic substring search across the
// fields an operator actually scans for -- name, asset code, serial
// number, category, and the system it belongs to (matched by name,
// since that's what's visible in the UI, not the raw systemId).
// Case-insensitive substring match only -- no fuzzy ranking, no search
// index, per the brief's "do not add a giant advanced-filter engine."
export function matchesEquipmentSearch(
  asset: {
    name: string;
    assetCode: string;
    serialNumber: string | null;
    category: string;
  },
  systemName: string | null,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [asset.name, asset.assetCode, asset.serialNumber ?? "", asset.category, systemName ?? ""];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

// ─── Wave 3: System-level attention summary ────────────────────────────
//
// Wave 3 §8: "Add a compact system-level Attention summary... Do not
// invent a system health score. Derive the worst factual condition /
// overdue maintenance among members." This is deliberately NOT a new
// scoring function -- it reuses summarizeSystemConditions's own
// worst-condition derivation and simply cross-references each member
// against the already-computed per-asset maintenance status map, the
// same one Command Center's attention panel uses.
export type SystemAttentionSummary = {
  worstCondition: EquipmentCondition | null;
  attentionAssetCount: number;
  overdueCount: number;
  dueSoonCount: number;
};

export function computeSystemAttentionSummary(
  systemId: number,
  assets: readonly EquipmentAssetRecord[],
  maintenanceStatusByAssetId: ReadonlyMap<number, MaintenanceStatus>,
): SystemAttentionSummary {
  const conditions = summarizeSystemConditions(systemId, assets);
  const members = assets.filter((a) => a.systemId === systemId);
  let overdueCount = 0;
  let dueSoonCount = 0;
  for (const member of members) {
    const status = maintenanceStatusByAssetId.get(member.id);
    if (status === "OVERDUE") overdueCount += 1;
    if (status === "DUE_SOON") dueSoonCount += 1;
  }
  return {
    worstCondition: conditions.worst,
    attentionAssetCount: conditions.counts.ATTENTION + conditions.counts.CRITICAL,
    overdueCount,
    dueSoonCount,
  };
}

// ─── Wave 2: Command Center attention (broadened) ─────────────────────

export type AttentionSeverity = "CRITICAL" | "ATTENTION" | "DUE_SOON";

export type AttentionItem = {
  assetId: number;
  severity: AttentionSeverity;
  reasons: string[];
};

const SEVERITY_RANK: Record<AttentionSeverity, number> = { CRITICAL: 0, ATTENTION: 1, DUE_SOON: 2 };

// Combines every deterministic attention source Wave 2 brief §4 lists
// (condition, overdue/due-soon maintenance, expired warranty) into one
// ranked list, one entry per asset with EVERY reason it's there --
// "No generic 'needs attention' without provenance." An asset matching
// multiple reasons is ranked at its single highest severity, not
// duplicated.
export function computeAttentionItems(
  assets: readonly EquipmentAssetRecord[],
  maintenanceStatusByAssetId: ReadonlyMap<number, MaintenanceStatus>,
  warrantyUntilByAssetId: ReadonlyMap<number, string | null | undefined>,
  today: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const asset of assets) {
    const reasons: string[] = [];
    let severity: AttentionSeverity | null = null;

    function raise(next: AttentionSeverity, reason: string) {
      reasons.push(reason);
      if (!severity || SEVERITY_RANK[next] < SEVERITY_RANK[severity]) severity = next;
    }

    if (asset.condition === "CRITICAL") raise("CRITICAL", "Condition: Critical");
    if (asset.condition === "ATTENTION") raise("ATTENTION", "Condition: Attention");

    const maintenanceStatus = maintenanceStatusByAssetId.get(asset.id);
    if (maintenanceStatus === "OVERDUE") raise("ATTENTION", "Maintenance overdue");
    if (maintenanceStatus === "DUE_SOON") raise("DUE_SOON", "Maintenance due soon");

    const warrantyUntil = warrantyUntilByAssetId.get(asset.id);
    if (warrantyUntil && warrantyUntil < today) raise("DUE_SOON", "Warranty expired");

    if (severity) items.push({ assetId: asset.id, severity, reasons });
  }
  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// ─── Wave 2: Acquisitions ──────────────────────────────────────────────

export type EquipmentAcquisitionInput = {
  name: string;
  stage?: string;
  problem: string;
  expectedImpact?: string | null;
  estimatedCost?: number | null;
  priority?: string;
  requiredBy?: string | null;
  riskReduction?: string | null;
  revenueImpact?: string | null;
  systemId?: number | null;
  domain?: string | null;
  notes?: string | null;
};

export function validateEquipmentAcquisitionInput(input: EquipmentAcquisitionInput): string | null {
  if (!input.name || !input.name.trim()) return "Name is required.";
  if (!input.problem || !input.problem.trim()) return "Problem is required -- what does this solve?";
  if (input.stage !== undefined && !isEquipmentAcquisitionStage(input.stage)) {
    return "Stage must be a recognized value.";
  }
  if (input.priority !== undefined && !isEquipmentAcquisitionPriority(input.priority)) {
    return "Priority must be a recognized value.";
  }
  if (input.estimatedCost != null && (Number.isNaN(input.estimatedCost) || input.estimatedCost < 0)) {
    return "Estimated cost must be zero or greater.";
  }
  if (input.domain != null && !isEquipmentDomain(input.domain)) {
    return "Domain must be a recognized value.";
  }
  if (input.requiredBy && !isValidIsoDate(input.requiredBy)) {
    return "Required-by date must be a valid date.";
  }
  return null;
}

// DEPLOYED and CANCELLED are terminal (Wave 2 brief §5's pipeline ends
// there) -- once an acquisition lands in either, its stage cannot be
// changed again. This is a restrained, cheap rule (not a full state
// machine of allowed forward/backward edges) that still prevents the one
// thing that would actually corrupt the record: reopening a decision
// that's already been acted on.
export function isAcquisitionStageTransitionAllowed(
  currentStage: EquipmentAcquisitionStage,
  nextStage: EquipmentAcquisitionStage,
): boolean {
  if (currentStage === nextStage) return true;
  return !(EQUIPMENT_ACQUISITION_TERMINAL_STAGES as readonly string[]).includes(currentStage);
}

export type EquipmentAcquisitionRecord = {
  id: number;
  priority: string;
  requiredBy: string | null;
  stage: string;
  createdAt: Date | string | number;
};

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Deterministic ranking for "Next Acquisitions": priority, then
// requiredBy (soonest/most-specified first, unset last), then
// createdAt (oldest decision first) -- explicitly NOT an AI/ML
// recommendation (Wave 2 brief §11: "Do not invent AI recommendations").
export function rankAcquisitions<T extends EquipmentAcquisitionRecord>(
  acquisitions: readonly T[],
): T[] {
  return [...acquisitions].sort((a, b) => {
    const priorityDiff = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    const aRequired = a.requiredBy ?? "9999-99-99";
    const bRequired = b.requiredBy ?? "9999-99-99";
    if (aRequired !== bRequired) return aRequired < bRequired ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// ─── Parent-cycle prevention ────────────────────────────────────────────
//
// Wave 2 brief §13: "parent cannot reference itself" / "prevent obvious
// parent cycles if possible cheaply." Walks the proposed parent's own
// ancestor chain looking for the asset being edited -- cheap (bounded by
// the actual composition depth, which Wave 1/2 keep shallow by design)
// and catches both the direct self-reference and any transitive cycle
// (A -> B -> C -> A) without needing a recursive tree editor.
export function wouldCreateParentCycle(
  assetId: number,
  proposedParentId: number | null,
  allAssets: readonly { id: number; parentAssetId: number | null }[],
): boolean {
  if (proposedParentId == null) return false;
  if (proposedParentId === assetId) return true;
  const byId = new Map(allAssets.map((a) => [a.id, a]));
  const seen = new Set<number>();
  let current: number | null = proposedParentId;
  while (current != null) {
    if (current === assetId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)?.parentAssetId ?? null;
  }
  return false;
}
