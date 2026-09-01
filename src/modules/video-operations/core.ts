import {
  BLOCKER_CATEGORIES,
  CHECKLIST_STATUSES,
  FRICTION_CATEGORIES,
  PRODUCTION_STEPS,
  REVISION_CATEGORIES,
  REVISION_CAUSES,
  type BlockerCategory,
  type ChecklistStatus,
  type FrictionCategory,
  type ProductionStep,
  type RevisionCategory,
  type RevisionCause,
} from "./config.ts";

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export const isFrictionCategory = (value: unknown): value is FrictionCategory =>
  isMember(FRICTION_CATEGORIES, value);
export const isBlockerCategory = (value: unknown): value is BlockerCategory =>
  isMember(BLOCKER_CATEGORIES, value);
export const isProductionStep = (value: unknown): value is ProductionStep =>
  isMember(PRODUCTION_STEPS, value);
export const isChecklistStatus = (value: unknown): value is ChecklistStatus =>
  isMember(CHECKLIST_STATUSES, value);
export const isRevisionCause = (value: unknown): value is RevisionCause =>
  isMember(REVISION_CAUSES, value);
export const isRevisionCategory = (value: unknown): value is RevisionCategory =>
  isMember(REVISION_CATEGORIES, value);

export function cleanRequiredText(
  value: unknown,
  label: string,
  maxLength: number,
): { success: true; value: string } | { success: false; error: string } {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned) return { success: false, error: `${label} is required.` };
  if (cleaned.length > maxLength) {
    return { success: false, error: `${label} is too long (max ${maxLength}).` };
  }
  return { success: true, value: cleaned };
}

export function cleanOptionalText(value: unknown, maxLength: number): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.length <= maxLength ? cleaned : false;
}

export function parseOptionalNonNegativeMinutes(value: unknown): number | null | false {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_080) return false;
  return parsed;
}

export function parseOptionalDueAt(value: unknown): Date | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? false : parsed;
}

export function computePromiseAccuracy(
  pairs: readonly { dueAt: Date | null; deliveredAt: Date }[],
) {
  const measurable = pairs.filter(
    (pair): pair is { dueAt: Date; deliveredAt: Date } => pair.dueAt !== null,
  );
  const deltasSeconds = measurable.map(
    (pair) => (pair.deliveredAt.getTime() - pair.dueAt.getTime()) / 1_000,
  );
  return {
    sampleCount: deltasSeconds.length,
    onTimeCount: deltasSeconds.filter((delta) => delta <= 0).length,
    lateCount: deltasSeconds.filter((delta) => delta > 0).length,
  };
}

export function computeChecklistProgress(
  items: readonly { status: ChecklistStatus }[],
) {
  const applicable = items.filter((item) => item.status !== "NOT_REQUIRED");
  const done = applicable.filter((item) => item.status === "DONE").length;
  return {
    done,
    applicable: applicable.length,
    complete: items.length > 0 && applicable.every((item) => item.status === "DONE"),
  };
}
