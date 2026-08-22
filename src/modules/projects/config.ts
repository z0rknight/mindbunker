export const PROJECT_STATUSES = [
  "planned",
  "active",
  "review",
  "delivered",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_GROUPS = ["active", "planned", "completed"] as const;

export type ProjectGroup = (typeof PROJECT_GROUPS)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  review: "In review",
  delivered: "Delivered",
  archived: "Archived",
};

export const PROJECT_GROUP_LABELS: Record<ProjectGroup, string> = {
  active: "Active projects",
  planned: "Planned / upcoming",
  completed: "Completed / inactive",
};

export const PROJECT_STATUS_GROUPS: Record<ProjectStatus, ProjectGroup> = {
  active: "active",
  review: "active",
  planned: "planned",
  delivered: "completed",
  archived: "completed",
};
