// Wave 2A: Friction Events. Rough by design.
export const FRICTION_CATEGORIES = [
  "FILES", "SOFTWARE", "CLIENT", "DECISION", "QA", "HARDWARE", "PROCESS", "INGEST", "OTHER",
] as const;
export type FrictionCategory = (typeof FRICTION_CATEGORIES)[number];

export function isFrictionCategory(v: unknown): v is FrictionCategory {
  return typeof v === "string" && (FRICTION_CATEGORIES as readonly string[]).includes(v);
}

export type FrictionEventRow = {
  id: number;
  category: FrictionCategory;
  clientId: number | null;
  projectId: number | null;
  videoId: number | null;
  workSessionId: number | null;
  note: string | null;
  minutesLost: number | null;
  createdAt: Date;
};

// "REPEATED FRICTION" -- a cheap experimental detector, explicitly NOT a
// recommendation engine: group by (category, a coarse note-keyword when
// present) and flag any group with >= threshold occurrences within the
// window. No ML, no scoring -- just counting.
export type RepeatedFrictionGroup = {
  category: FrictionCategory;
  keyword: string | null;
  count: number;
};

function noteKeyword(note: string | null): string | null {
  if (!note) return null;
  // First significant word, uppercased -- deliberately crude.
  const word = note.trim().split(/\s+/)[0];
  return word ? word.toUpperCase().replace(/[^A-Z0-9_]/g, "") || null : null;
}

export function detectRepeatedFriction(
  events: Pick<FrictionEventRow, "category" | "note">[],
  threshold = 3,
): RepeatedFrictionGroup[] {
  const groups = new Map<string, RepeatedFrictionGroup>();
  for (const e of events) {
    const keyword = noteKeyword(e.note);
    const key = `${e.category}::${keyword ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { category: e.category, keyword, count: 1 });
  }
  return [...groups.values()]
    .filter((g) => g.count >= threshold)
    .sort((a, b) => b.count - a.count);
}

export function frictionCountsByCategory(
  events: Pick<FrictionEventRow, "category">[],
): Record<FrictionCategory, number> {
  const counts = Object.fromEntries(FRICTION_CATEGORIES.map((c) => [c, 0])) as Record<FrictionCategory, number>;
  for (const e of events) counts[e.category] += 1;
  return counts;
}
