import {
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CRITICALITY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentCondition,
  type EquipmentCriticality,
  type EquipmentStatus,
} from "@/modules/equipment/config";

// Mirrors ProjectStatusBadge's pattern (pill + status->class lookup) --
// three small badges instead of one generic one because status/
// condition/criticality are semantically distinct axes (Wave 1 brief §2)
// and conflating them into one badge would blur that distinction visually.

const STATUS_CLASSES: Record<EquipmentStatus, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  RESERVE: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  LOANED: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  MAINTENANCE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  RETIRED: "border-zinc-700 bg-zinc-900 text-zinc-500",
  SOLD: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {EQUIPMENT_STATUS_LABELS[status]}
    </span>
  );
}

// Deliberately the only place condition maps to color -- condition itself
// stays a plain categorical string everywhere else (core.ts, actions.ts,
// the DB). See Equipment Wave 1 brief §2: "Do not create fake precision
// such as 'Health 83.7%'. Condition is categorical."
const CONDITION_CLASSES: Record<EquipmentCondition, string> = {
  EXCELLENT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  GOOD: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  ATTENTION: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function EquipmentConditionBadge({ condition }: { condition: EquipmentCondition }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${CONDITION_CLASSES[condition]}`}
    >
      {EQUIPMENT_CONDITION_LABELS[condition]}
    </span>
  );
}

const CRITICALITY_CLASSES: Record<EquipmentCriticality, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-300",
  PRODUCTION: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  CONVENIENCE: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  HOBBY: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

export function EquipmentCriticalityBadge({ criticality }: { criticality: EquipmentCriticality }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${CRITICALITY_CLASSES[criticality]}`}
    >
      {EQUIPMENT_CRITICALITY_LABELS[criticality]}
    </span>
  );
}

// Wave 2: maintenance posture, derived purely from recorded facts (see
// core.ts#computeMaintenanceStatus) -- NONE is its own visible state,
// deliberately not styled as "fine" (Wave 2 brief §3/§12: missing
// nextInspection is not health).
const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  OVERDUE: "Maintenance Overdue",
  DUE_SOON: "Maintenance Due Soon",
  SCHEDULED: "Maintenance Scheduled",
  NONE: "No Maintenance Logged",
};

const MAINTENANCE_STATUS_CLASSES: Record<string, string> = {
  OVERDUE: "border-red-500/30 bg-red-500/10 text-red-300",
  DUE_SOON: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SCHEDULED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  NONE: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

export function MaintenanceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${MAINTENANCE_STATUS_CLASSES[status] ?? MAINTENANCE_STATUS_CLASSES.NONE}`}
    >
      {MAINTENANCE_STATUS_LABELS[status] ?? "Unknown"}
    </span>
  );
}
