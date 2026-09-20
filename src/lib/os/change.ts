// Change detection for operator feedback (Train M3). Pure, React-free.
// The server-rendered pages revalidate and hand components new props; these
// helpers decide WHAT changed between two canonical snapshots so the UI can
// mark the smallest truthful target. They never decide what a change means.

export type Primitive = string | number | boolean | null | undefined;

/** Keys whose values differ between two snapshots (primitive comparison). */
export function changedKeys(prev: Record<string, Primitive>, next: Record<string, Primitive>): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  return [...keys].filter((key) => !Object.is(prev[key], next[key]));
}

/** Ids present in `next` that were not in `prev` (new arrivals), in `next` order. */
export function newIds(prev: readonly string[], next: readonly string[]): string[] {
  const seen = new Set(prev);
  return next.filter((id) => !seen.has(id));
}

/**
 * Smallest truthful target for a set of changed keys:
 *  - nothing changed -> none
 *  - exactly one field changed -> that cell
 *  - several fields changed -> the whole row
 */
export function flashTarget(changed: readonly string[]): { kind: "none" } | { kind: "cell"; key: string } | { kind: "row" } {
  if (changed.length === 0) return { kind: "none" };
  if (changed.length === 1) return { kind: "cell", key: changed[0] };
  return { kind: "row" };
}

/** Ids that were in `prev` and are no longer in `next` (items that left a queue), in `prev` order. */
export function goneIds(prev: readonly string[], next: readonly string[]): string[] {
  const present = new Set(next);
  return prev.filter((id) => !present.has(id));
}
