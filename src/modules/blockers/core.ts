// Wave 3F: BLOCKER = work cannot progress (distinct from FRICTION = a
// painful interruption/event). A friction event does not imply a blocker;
// a blocker is not automatically a friction event.
export const BLOCKER_CATEGORIES = ["CLIENT", "FILES", "HARDWARE", "SOFTWARE", "DECISION", "PAYMENT", "INGEST", "OTHER"] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number];

export function isBlockerCategory(v: unknown): v is BlockerCategory {
  return typeof v === "string" && (BLOCKER_CATEGORIES as readonly string[]).includes(v);
}

export type BlockerRow = { id: number; category: BlockerCategory; startedAt: Date; resolvedAt: Date | null };

export function blockedSeconds(b: Pick<BlockerRow, "startedAt" | "resolvedAt">, now: Date = new Date()): number {
  const end = b.resolvedAt ?? now;
  return Math.max(0, (end.getTime() - b.startedAt.getTime()) / 1000);
}

export function isCurrentlyBlocked(b: Pick<BlockerRow, "resolvedAt">): boolean {
  return b.resolvedAt === null;
}
