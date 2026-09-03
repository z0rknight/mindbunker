// Equipment Wave 1 (Foundation + Command Center + Asset Registry).
//
// Equipment is the operational and patrimonial registry of the physical
// infrastructure that enables Emmanuel/RMedia to work -- NOT a wishlist,
// NOT a generic inventory app. One master asset registry: Personal vs
// RMedia is a classification (ownership), never a separate table/database
// (see the Equipment Wave 1 brief §2 -- explicit instruction not to split
// personal/RMedia into parallel schemas).
//
// Condition is deliberately categorical, never a fabricated percentage --
// same discipline the Health module already applies (no "Health Score
// 83/100" composite; see MINDBUNKER_MASTER_QA_LEDGER.md HEALTH-005).

export const EQUIPMENT_OWNERSHIPS = [
  "PERSONAL",
  "RMEDIA",
  "FAMILY",
  "THIRD_PARTY",
] as const;
export type EquipmentOwnership = (typeof EQUIPMENT_OWNERSHIPS)[number];

export const EQUIPMENT_DOMAINS = [
  "COMPUTE",
  "STORAGE",
  "NETWORK",
  "VIDEO",
  "PHOTO",
  "AUDIO",
  "POWER",
  "OTHER",
] as const;
export type EquipmentDomain = (typeof EQUIPMENT_DOMAINS)[number];

export const EQUIPMENT_STATUSES = [
  "ACTIVE",
  "RESERVE",
  "LOANED",
  "MAINTENANCE",
  "RETIRED",
  "SOLD",
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_CONDITIONS = [
  "EXCELLENT",
  "GOOD",
  "ATTENTION",
  "CRITICAL",
] as const;
export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

export const EQUIPMENT_CRITICALITIES = [
  "CRITICAL",
  "PRODUCTION",
  "CONVENIENCE",
  "HOBBY",
] as const;
export type EquipmentCriticality = (typeof EQUIPMENT_CRITICALITIES)[number];

// Systems get a smaller, coarser status vocabulary than individual
// assets -- a System is an operational grouping, not a physical thing
// that can itself be LOANED/SOLD.
export const EQUIPMENT_SYSTEM_STATUSES = ["ACTIVE", "RESERVE", "RETIRED"] as const;
export type EquipmentSystemStatus = (typeof EQUIPMENT_SYSTEM_STATUSES)[number];

export const EQUIPMENT_OWNERSHIP_LABELS: Record<EquipmentOwnership, string> = {
  PERSONAL: "Personal",
  RMEDIA: "RMedia",
  FAMILY: "Family",
  THIRD_PARTY: "Third-party",
};

export const EQUIPMENT_DOMAIN_LABELS: Record<EquipmentDomain, string> = {
  COMPUTE: "Compute",
  STORAGE: "Storage",
  NETWORK: "Network",
  VIDEO: "Video",
  PHOTO: "Photo",
  AUDIO: "Audio",
  POWER: "Power",
  OTHER: "Other",
};

export const EQUIPMENT_DOMAIN_ICONS: Record<EquipmentDomain, string> = {
  COMPUTE: "🖥️",
  STORAGE: "💾",
  NETWORK: "🌐",
  VIDEO: "🎥",
  PHOTO: "📷",
  AUDIO: "🎙️",
  POWER: "🔌",
  OTHER: "📦",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: "Active",
  RESERVE: "Reserve",
  LOANED: "Loaned",
  MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
  SOLD: "Sold",
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
};

export const EQUIPMENT_CRITICALITY_LABELS: Record<EquipmentCriticality, string> = {
  CRITICAL: "Critical",
  PRODUCTION: "Production",
  CONVENIENCE: "Convenience",
  HOBBY: "Hobby",
};

export const EQUIPMENT_SYSTEM_STATUS_LABELS: Record<EquipmentSystemStatus, string> = {
  ACTIVE: "Active",
  RESERVE: "Reserve",
  RETIRED: "Retired",
};

// Short codes used to build assetCode (see core.ts#buildAssetCode). Kept
// separate from the enum values themselves so a future relabeling of the
// human-readable enum never silently changes already-issued codes.
export const EQUIPMENT_OWNERSHIP_CODE: Record<EquipmentOwnership, string> = {
  PERSONAL: "PER",
  RMEDIA: "RM",
  FAMILY: "FAM",
  THIRD_PARTY: "3RD",
};

export const EQUIPMENT_DOMAIN_CODE: Record<EquipmentDomain, string> = {
  COMPUTE: "COMP",
  STORAGE: "STOR",
  NETWORK: "NET",
  VIDEO: "VID",
  PHOTO: "PHO",
  AUDIO: "AUD",
  POWER: "PWR",
  OTHER: "OTH",
};

// Only ATTENTION/CRITICAL conditions surface an asset on the Command
// Center's "Needs Attention" panel -- EXCELLENT/GOOD are silent by design.
export const EQUIPMENT_ATTENTION_CONDITIONS: readonly EquipmentCondition[] = [
  "ATTENTION",
  "CRITICAL",
];

export const DEFAULT_EQUIPMENT_CURRENCY = "BRL";

export function isEquipmentOwnership(value: unknown): value is EquipmentOwnership {
  return typeof value === "string" && (EQUIPMENT_OWNERSHIPS as readonly string[]).includes(value);
}

export function isEquipmentDomain(value: unknown): value is EquipmentDomain {
  return typeof value === "string" && (EQUIPMENT_DOMAINS as readonly string[]).includes(value);
}

export function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return typeof value === "string" && (EQUIPMENT_STATUSES as readonly string[]).includes(value);
}

export function isEquipmentCondition(value: unknown): value is EquipmentCondition {
  return typeof value === "string" && (EQUIPMENT_CONDITIONS as readonly string[]).includes(value);
}

export function isEquipmentCriticality(value: unknown): value is EquipmentCriticality {
  return typeof value === "string" && (EQUIPMENT_CRITICALITIES as readonly string[]).includes(value);
}

// ─── Wave 2: Maintenance ───────────────────────────────────────────────
//
// Maintenance state is derived from facts (a recorded nextInspection date
// compared to today), never a fabricated schedule or health score --
// see core.ts#computeMaintenanceStatus. No maintenance history at all is
// its own state (NONE), deliberately NOT treated as "healthy" (Wave 2
// brief §12/§3: "Do not treat missing nextInspection as healthy").
export const EQUIPMENT_MAINTENANCE_TYPES = [
  "INSPECTION",
  "CLEANING",
  "REPAIR",
  "UPGRADE",
  "REPLACEMENT",
  "FIRMWARE",
  "TEST",
  "OTHER",
] as const;
export type EquipmentMaintenanceType = (typeof EQUIPMENT_MAINTENANCE_TYPES)[number];

export const EQUIPMENT_MAINTENANCE_TYPE_LABELS: Record<EquipmentMaintenanceType, string> = {
  INSPECTION: "Inspection",
  CLEANING: "Cleaning",
  REPAIR: "Repair",
  UPGRADE: "Upgrade",
  REPLACEMENT: "Replacement",
  FIRMWARE: "Firmware",
  TEST: "Test",
  OTHER: "Other",
};

export function isEquipmentMaintenanceType(value: unknown): value is EquipmentMaintenanceType {
  return typeof value === "string" && (EQUIPMENT_MAINTENANCE_TYPES as readonly string[]).includes(value);
}

// ─── Wave 2: Acquisitions ──────────────────────────────────────────────
//
// A restrained, non-accounting pipeline (Wave 2 brief §5): what's being
// considered, why, how urgent, what stage. Explicitly NOT probability
// percentages, NOT procurement accounting, NOT synced to Finance.
export const EQUIPMENT_ACQUISITION_STAGES = [
  "IDEA",
  "RESEARCH",
  "APPROVED",
  "BUDGETED",
  "ORDERED",
  "RECEIVED",
  "DEPLOYED",
  "CANCELLED",
] as const;
export type EquipmentAcquisitionStage = (typeof EQUIPMENT_ACQUISITION_STAGES)[number];

export const EQUIPMENT_ACQUISITION_STAGE_LABELS: Record<EquipmentAcquisitionStage, string> = {
  IDEA: "Idea",
  RESEARCH: "Research",
  APPROVED: "Approved",
  BUDGETED: "Budgeted",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  DEPLOYED: "Deployed",
  CANCELLED: "Cancelled",
};

// DEPLOYED and CANCELLED are terminal -- see core.ts#isAcquisitionStageTransitionAllowed.
export const EQUIPMENT_ACQUISITION_TERMINAL_STAGES: readonly EquipmentAcquisitionStage[] = [
  "DEPLOYED",
  "CANCELLED",
];

export const EQUIPMENT_ACQUISITION_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type EquipmentAcquisitionPriority = (typeof EQUIPMENT_ACQUISITION_PRIORITIES)[number];

export const EQUIPMENT_ACQUISITION_PRIORITY_LABELS: Record<EquipmentAcquisitionPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function isEquipmentAcquisitionStage(value: unknown): value is EquipmentAcquisitionStage {
  return typeof value === "string" && (EQUIPMENT_ACQUISITION_STAGES as readonly string[]).includes(value);
}

export function isEquipmentAcquisitionPriority(value: unknown): value is EquipmentAcquisitionPriority {
  return typeof value === "string" && (EQUIPMENT_ACQUISITION_PRIORITIES as readonly string[]).includes(value);
}

// Deterministic "due soon" window for maintenance nextInspection dates.
// 30 days chosen as a plain, explainable operator-relevant horizon (not
// tuned/ML'd) -- documented here so it's a single, greppable source of
// truth rather than a magic number buried in core.ts.
export const EQUIPMENT_MAINTENANCE_DUE_SOON_DAYS = 30;
