import {
  PROJECT_STATUSES,
  type ProjectStatus,
} from "./config.ts";

export type ProjectInput = {
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  notes: string | null;
};

type ProjectInputResult =
  | { success: true; data: ProjectInput }
  | { success: false; error: string };

export function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    PROJECT_STATUSES.includes(value as ProjectStatus)
  );
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateProjectInput(values: {
  name: unknown;
  status: unknown;
  deadline?: unknown;
  notes?: unknown;
}): ProjectInputResult {
  const name = cleanOptionalText(values.name, 160);
  if (!name) {
    return { success: false, error: "Project name is required." };
  }
  if (!isProjectStatus(values.status)) {
    return { success: false, error: "Choose a valid project status." };
  }

  const deadline = cleanOptionalText(values.deadline, 10);
  if (deadline && !isDateKey(deadline)) {
    return { success: false, error: "Choose a valid project deadline." };
  }

  return {
    success: true,
    data: {
      name,
      status: values.status,
      deadline,
      notes: cleanOptionalText(values.notes, 5_000),
    },
  };
}
