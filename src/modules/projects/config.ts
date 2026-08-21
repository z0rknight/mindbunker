export const PROJECT_STATUSES = [
  "planned",
  "active",
  "review",
  "delivered",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  review: "In review",
  delivered: "Delivered",
  archived: "Archived",
};
