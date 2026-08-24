import {
  PROJECT_GROUPS,
  PROJECT_STATUSES,
  PROJECT_STATUS_GROUPS,
  type ProjectGroup,
  type ProjectStatus,
} from "./config.ts";

export type ProjectOverviewItem = {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
  notes: string | null;
  updatedAt: Date | null;
  totalVideos: number;
  doneVideos: number;
  inFlightVideos: number;
  plannedVideos: number;
};

export type ProjectOverviewGroups = Record<
  ProjectGroup,
  ProjectOverviewItem[]
>;

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

export function getProjectGroup(status: ProjectStatus): ProjectGroup {
  return PROJECT_STATUS_GROUPS[status];
}

export function isProjectOverdue(
  project: Pick<ProjectOverviewItem, "deadline" | "status">,
  today: string,
) {
  return (
    Boolean(project.deadline && project.deadline < today) &&
    getProjectGroup(project.status) !== "completed"
  );
}

export function getProjectProgress(project: Pick<
  ProjectOverviewItem,
  "totalVideos" | "doneVideos"
>) {
  if (project.totalVideos === 0) return 0;
  return Math.round((project.doneVideos / project.totalVideos) * 100);
}

function compareNullableDates(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export function groupProjectsForOverview(
  projects: ProjectOverviewItem[],
): ProjectOverviewGroups {
  const groups: ProjectOverviewGroups = {
    active: [],
    planned: [],
    completed: [],
  };

  for (const project of projects) {
    groups[getProjectGroup(project.status)].push(project);
  }

  for (const group of PROJECT_GROUPS) {
    groups[group].sort((a, b) => {
      if (group === "active" && a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      const deadlineOrder = compareNullableDates(a.deadline, b.deadline);
      if (deadlineOrder !== 0) return deadlineOrder;
      const updatedOrder =
        (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      return updatedOrder || b.id - a.id;
    });
  }

  return groups;
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

// Brief C ("Final Local Ingest / Live Readiness") §9: deterministic Project
// workspace video ordering. Real bulk-generated names ("Bonnie Content
// Waterfall_1" ... "_9") must not lexically sort as 1, 10 (n/a here but
// still), 2, 3... i.e. "_2" must sort before "_10" whenever both exist.
// This is a pure string comparator (numeric-aware "natural sort"), applied
// after the batch-label/date grouping described in §9 -- see
// sortProjectWorkspaceVideos below for how the three keys combine.
export function naturalCompare(a: string, b: string): number {
  const chunk = /(\d+|\D+)/g;
  const aParts = a.match(chunk) ?? [a];
  const bParts = b.match(chunk) ?? [b];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";
    const aNum = /^\d+$/.test(aPart) ? Number(aPart) : null;
    const bNum = /^\d+$/.test(bPart) ? Number(bPart) : null;
    if (aNum !== null && bNum !== null) {
      if (aNum !== bNum) return aNum - bNum;
      continue;
    }
    const cmp = aPart.localeCompare(bPart);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export type ProjectWorkspaceVideoOrderInput = {
  id: number;
  title: string | null;
  date: string;
  batchLabel: string | null;
};

// Preferred order per §9: batch label (grouping batches together, videos
// with no batch label first), then historical date, then natural
// numeric-aware name ordering. Falls back to id for total determinism when
// every other key ties (never leaves ordering to insertion/query-plan
// accident).
export function sortProjectWorkspaceVideos<
  T extends ProjectWorkspaceVideoOrderInput,
>(videos: readonly T[]): T[] {
  return [...videos].sort((a, b) => {
    const batchA = a.batchLabel ?? "";
    const batchB = b.batchLabel ?? "";
    if (batchA !== batchB) return batchA.localeCompare(batchB);
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const titleA = a.title ?? "";
    const titleB = b.title ?? "";
    const titleCmp = naturalCompare(titleA, titleB);
    if (titleCmp !== 0) return titleCmp;
    return a.id - b.id;
  });
}
