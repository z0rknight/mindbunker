// Monday Local Intelligence Lab, §L/M/N — Screen Time manual import: pure
// validation + normalization logic. No DB access here — see actions.ts.
// This is a MANUAL APPLE SCREEN TIME SNAPSHOT importer: a person pastes in
// a structured JSON payload they (or an external tool) prepared from what
// Apple's own Screen Time UI shows. There is no OCR and no automatic
// sensing anywhere in this path -- see ARTIFACT_CONTRACT-style labeling
// requirements in the UI layer.

export type ScreenTimeCategoryInput = {
  name: string;
  hours: number;
};

export type ScreenTimeAppInput = {
  name: string;
  hours: number;
  category?: string;
};

export type ScreenTimeSnapshotInput = {
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string; // ISO date YYYY-MM-DD
  device: string;
  totalHours: number;
  categories?: ScreenTimeCategoryInput[];
  apps?: ScreenTimeAppInput[];
};

export type ScreenTimeValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: string[] };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateScreenTimeSnapshotInput(
  input: unknown,
): ScreenTimeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Payload must be a JSON object."] };
  }
  const payload = input as Record<string, unknown>;

  const periodStart = payload.periodStart;
  const periodEnd = payload.periodEnd;
  const device = payload.device;
  const totalHours = payload.totalHours;

  if (typeof periodStart !== "string" || !ISO_DATE_RE.test(periodStart)) {
    errors.push('"periodStart" must be a date string like "2026-08-17".');
  }
  if (typeof periodEnd !== "string" || !ISO_DATE_RE.test(periodEnd)) {
    errors.push('"periodEnd" must be a date string like "2026-08-23".');
  }
  if (
    typeof periodStart === "string" &&
    typeof periodEnd === "string" &&
    ISO_DATE_RE.test(periodStart) &&
    ISO_DATE_RE.test(periodEnd) &&
    periodEnd < periodStart
  ) {
    errors.push('"periodEnd" must not be before "periodStart".');
  }
  if (typeof device !== "string" || device.trim().length === 0) {
    errors.push('"device" must be a non-empty string.');
  }
  if (
    typeof totalHours !== "number" ||
    !Number.isFinite(totalHours) ||
    totalHours < 0
  ) {
    errors.push('"totalHours" must be a non-negative number.');
  }

  const categories = payload.categories;
  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      errors.push('"categories" must be an array if present.');
    } else {
      categories.forEach((c, i) => {
        if (typeof c !== "object" || c === null) {
          errors.push(`categories[${i}] must be an object.`);
          return;
        }
        const cat = c as Record<string, unknown>;
        if (typeof cat.name !== "string" || cat.name.trim().length === 0) {
          errors.push(`categories[${i}].name must be a non-empty string.`);
        }
        if (
          typeof cat.hours !== "number" ||
          !Number.isFinite(cat.hours) ||
          cat.hours < 0
        ) {
          errors.push(`categories[${i}].hours must be a non-negative number.`);
        }
      });
    }
  }

  const apps = payload.apps;
  if (apps !== undefined) {
    if (!Array.isArray(apps)) {
      errors.push('"apps" must be an array if present.');
    } else {
      apps.forEach((a, i) => {
        if (typeof a !== "object" || a === null) {
          errors.push(`apps[${i}] must be an object.`);
          return;
        }
        const app = a as Record<string, unknown>;
        if (typeof app.name !== "string" || app.name.trim().length === 0) {
          errors.push(`apps[${i}].name must be a non-empty string.`);
        }
        if (
          typeof app.hours !== "number" ||
          !Number.isFinite(app.hours) ||
          app.hours < 0
        ) {
          errors.push(`apps[${i}].hours must be a non-negative number.`);
        }
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Hard rule (§N): app hours must never silently become canonical over
  // the reported total. Apple's own export can legitimately have apps sum
  // higher than the total (overlapping/multitasking usage), so this is
  // surfaced as a warning for the human to see -- never auto-corrected.
  if (Array.isArray(apps) && typeof totalHours === "number") {
    const appHoursSum = (apps as ScreenTimeAppInput[]).reduce(
      (sum, a) => sum + (typeof a.hours === "number" ? a.hours : 0),
      0,
    );
    if (appHoursSum > totalHours + 0.01) {
      warnings.push(
        `App hours sum to ${appHoursSum.toFixed(1)}h, more than the reported total of ${totalHours.toFixed(1)}h. The reported total was kept as-is -- shown here as a warning, not corrected automatically.`,
      );
    }
  }

  return { valid: true, warnings };
}

export type NormalizedScreenTimeSnapshot = {
  periodStart: string;
  periodEnd: string;
  device: string;
  totalMinutes: number;
  categories: ScreenTimeCategoryInput[];
  apps: ScreenTimeAppInput[];
};

// Only call after validateScreenTimeSnapshotInput returns valid: true.
export function normalizeScreenTimeSnapshotInput(
  input: ScreenTimeSnapshotInput,
): NormalizedScreenTimeSnapshot {
  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    device: input.device.trim(),
    totalMinutes: Math.round(input.totalHours * 60),
    categories: (input.categories ?? []).map((c) => ({
      name: c.name.trim(),
      hours: c.hours,
    })),
    apps: (input.apps ?? []).map((a) => ({
      name: a.name.trim(),
      hours: a.hours,
      category: a.category?.trim(),
    })),
  };
}

export type DuplicatePeriodCheck = {
  isDuplicate: boolean;
  isExactRepeat: boolean;
};

// "Duplicate-period imports should warn or be idempotent" (§N): an exact
// repeat (same period + device + total) is idempotent -- the caller skips
// re-inserting. A same period+device but different total is a duplicate
// with different numbers -- the caller surfaces a warning but still stores
// it (never silently discards a re-exported snapshot with different
// figures).
export function checkDuplicatePeriod(
  normalized: NormalizedScreenTimeSnapshot,
  existing: readonly {
    periodStart: string;
    periodEnd: string;
    device: string;
    totalMinutes: number;
  }[],
): DuplicatePeriodCheck {
  const samePeriodDevice = existing.filter(
    (e) =>
      e.periodStart === normalized.periodStart &&
      e.periodEnd === normalized.periodEnd &&
      e.device === normalized.device,
  );
  if (samePeriodDevice.length === 0) {
    return { isDuplicate: false, isExactRepeat: false };
  }
  const exactRepeat = samePeriodDevice.some(
    (e) => e.totalMinutes === normalized.totalMinutes,
  );
  return { isDuplicate: true, isExactRepeat: exactRepeat };
}

export type TopEntry = { name: string; hours: number };

export function topByHours(
  entries: readonly TopEntry[],
  limit: number,
): TopEntry[] {
  return [...entries].sort((a, b) => b.hours - a.hours).slice(0, limit);
}
