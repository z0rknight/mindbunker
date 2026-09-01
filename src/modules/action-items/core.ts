// Wave 4N/4O: Action Radar + Capture Inbox share one primitive.
export const ACTION_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

const PRIORITY_RANK: Record<ActionPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function sortActionItemsByPriority<T extends { priority: string; dueAt: Date | null; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pr = (PRIORITY_RANK[a.priority as ActionPriority] ?? 9) - (PRIORITY_RANK[b.priority as ActionPriority] ?? 9);
    if (pr !== 0) return pr;
    const aDue = a.dueAt ? a.dueAt.getTime() : Infinity;
    const bDue = b.dueAt ? b.dueAt.getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
