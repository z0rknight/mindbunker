import { PRODUCTION_STEPS, CHECKLIST_STATUSES, type ProductionStep, type ChecklistStatus } from "./core";

export function isProductionStep(v: unknown): v is ProductionStep {
  return typeof v === "string" && (PRODUCTION_STEPS as readonly string[]).includes(v);
}
export function isChecklistStatus(v: unknown): v is ChecklistStatus {
  return typeof v === "string" && (CHECKLIST_STATUSES as readonly string[]).includes(v);
}
