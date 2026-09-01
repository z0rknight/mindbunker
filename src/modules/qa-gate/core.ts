// Wave 2C: lightweight QA checklist. Not approval bureaucracy -- one
// checklist snapshot per QA event, no per-check history table.
export const QA_CHECKS = [
  { key: "names", label: "Names" },
  { key: "spelling", label: "Brand/product spelling" },
  { key: "captions", label: "Captions" },
  { key: "audio", label: "Audio" },
  { key: "color", label: "Color/HDR" },
  { key: "assets", label: "Correct assets" },
  { key: "playback", label: "Full playback" },
] as const;
export type QaCheckKey = (typeof QA_CHECKS)[number]["key"];

export const QA_CAUSES = ["OUR_ERROR", "CLIENT_CHANGE", "SCOPE_CHANGE", "UNKNOWN"] as const;
export type QaCause = (typeof QA_CAUSES)[number];

export function allChecksPassed(checklist: Record<string, boolean>): boolean {
  return QA_CHECKS.every((c) => checklist[c.key] === true);
}

export function parseChecklist(json: string | null): Record<string, boolean> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as Record<string, boolean>;
  } catch {
    // rough experiment -- malformed json is just treated as empty
  }
  return {};
}
