// Wave 3A: Work Session Repair. Soft invalidation only, never hard delete.
export const INTEGRITY_STATES = ["NORMAL", "STALE", "CORRECTED", "INVALID", "REQUIRES_REVIEW"] as const;
export type IntegrityState = (typeof INTEGRITY_STATES)[number];

export function deriveIntegrityState(row: { integrityState: string; endedAt: Date | null; elapsedSeconds: number }): IntegrityState {
  if (row.integrityState === "INVALID" || row.integrityState === "CORRECTED") return row.integrityState as IntegrityState;
  if (!row.endedAt && row.elapsedSeconds >= 6 * 60 * 60) return "STALE";
  return (row.integrityState as IntegrityState) ?? "NORMAL";
}
