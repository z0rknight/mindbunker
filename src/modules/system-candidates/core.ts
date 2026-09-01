// Wave 3J: System Candidate Detector. Simple thresholds only, no scoring.
export type SystemCandidate = { key: string; category: string; keyword: string | null; count: number; minutesLost: number };

export function detectSystemCandidates(
  events: { category: string; note: string | null; minutesLost: number | null }[],
  countThreshold = 3,
  minutesThreshold = 60,
): SystemCandidate[] {
  const groups = new Map<string, SystemCandidate>();
  for (const e of events) {
    const keyword = e.note ? (e.note.trim().split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9_]/g, "") || null) : null;
    const key = `${e.category}::${keyword ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.minutesLost += e.minutesLost ?? 0;
    } else {
      groups.set(key, { key, category: e.category, keyword, count: 1, minutesLost: e.minutesLost ?? 0 });
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= countThreshold || g.minutesLost >= minutesThreshold)
    .sort((a, b) => b.count - a.count);
}
