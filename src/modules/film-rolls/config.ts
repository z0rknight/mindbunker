export const FILM_ROLL_STATUSES = ["BUILDING", "READY", "ARCHIVED"] as const;
export type FilmRollStatus = (typeof FILM_ROLL_STATUSES)[number];

export const FILM_ROLL_STATUS_LABELS: Record<FilmRollStatus, string> = {
  BUILDING: "Building",
  READY: "Ready to use",
  ARCHIVED: "Archived",
};

export function isFilmRollStatus(value: unknown): value is FilmRollStatus {
  return typeof value === "string" && FILM_ROLL_STATUSES.includes(value as FilmRollStatus);
}

export type FilmRollSubjectInput = { label: string; shotCount: number };

export function validateSubjectInventory(value: string):
  | { success: true; subjects: FilmRollSubjectInput[] }
  | { success: false; error: string } {
  const seen = new Set<string>();
  const subjects: FilmRollSubjectInput[] = [];
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.length > 0);

  for (const entry of lines) {
    const match = entry.line.match(/^([^:]+):\s*(\d+)$/);
    if (!match) {
      return { success: false, error: `Subject line ${entry.number} must use “label: positive count”.` };
    }
    const label = match[1].trim();
    const shotCount = Number(match[2]);
    if (!label || label.length > 80 || !Number.isSafeInteger(shotCount) || shotCount < 1 || shotCount > 999_999) {
      return { success: false, error: `Subject line ${entry.number} has an invalid label or count.` };
    }
    const key = label.toLocaleLowerCase("en-US");
    if (seen.has(key)) {
      return { success: false, error: `Subject line ${entry.number} duplicates “${label}”.` };
    }
    seen.add(key);
    subjects.push({ label, shotCount });
  }
  return { success: true, subjects };
}
