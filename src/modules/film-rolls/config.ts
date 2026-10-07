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

export function parseSubjectInventory(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawLabel, rawCount] = line.split(":", 2);
      const label = rawLabel?.trim().slice(0, 80) ?? "";
      const count = Number.parseInt(rawCount?.trim() ?? "", 10);
      return { label, shotCount: Number.isFinite(count) && count > 0 ? count : 0 };
    })
    .filter((row) => row.label.length > 0 && row.shotCount > 0);
}
