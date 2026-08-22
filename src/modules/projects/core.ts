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
