import type { VideoStatus } from "../productivity/config.ts";
import { validateDeliveryUrl } from "../productivity/core.ts";
import type { ProjectStatus } from "../projects/config.ts";

export const CLIENT_VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In production",
  READY_FOR_REVIEW: "Review",
  CHANGES_REQUESTED: "Updates in progress",
  DONE: "Delivered",
};

export const CLIENT_PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Upcoming",
  active: "Active",
  review: "Review",
  delivered: "Completed",
  archived: "Completed",
};

const PROJECT_STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  review: 1,
  planned: 2,
  delivered: 3,
  archived: 4,
};

export type ClientPortalProjectRow = {
  id: number;
  clientId: number;
  name: string;
  status: ProjectStatus;
  deadline: string | null;
};

export type ClientPortalVideoRow = {
  projectId: number | null;
  clientId: number | null;
  projectClientId: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  deliveryUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ClientPortalProject = {
  name: string;
  status: string;
  deadline: string | null;
  videos: Array<{
    title: string;
    status: string;
    lastUpdated: string | null;
    deliveryUrl: string | null;
  }>;
};

function lastMeaningfulUpdate(video: ClientPortalVideoRow) {
  const value = video.updatedAt ?? video.createdAt;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

/**
 * Defense-in-depth projection. Database queries are already scoped by the
 * capability token; this function applies ownership checks again and strips
 * every internal identifier before data reaches the portal page.
 */
export function buildClientPortalProjects(
  authenticatedClientId: number,
  projectRows: readonly ClientPortalProjectRow[],
  videoRows: readonly ClientPortalVideoRow[],
): ClientPortalProject[] {
  const ownedProjects = projectRows
    .filter((project) => project.clientId === authenticatedClientId)
    .toSorted((a, b) => {
      const statusDifference =
        PROJECT_STATUS_ORDER[a.status] - PROJECT_STATUS_ORDER[b.status];
      if (statusDifference !== 0) return statusDifference;
      return (a.deadline ?? "9999-12-31").localeCompare(
        b.deadline ?? "9999-12-31",
      );
    });
  const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));

  return ownedProjects.map((project) => ({
    name: project.name,
    status: CLIENT_PROJECT_STATUS_LABELS[project.status],
    deadline: project.deadline,
    videos: videoRows
      .filter(
        (video) =>
          video.projectId === project.id &&
          ownedProjectIds.has(project.id) &&
          video.clientId === authenticatedClientId &&
          video.projectClientId === authenticatedClientId,
      )
      .map((video) => {
        const deliveryUrl = validateDeliveryUrl(video.deliveryUrl);
        return {
          title: video.title?.trim() || `Video ${video.date}`,
          status: CLIENT_VIDEO_STATUS_LABELS[video.status],
          lastUpdated: lastMeaningfulUpdate(video),
          deliveryUrl: deliveryUrl.success ? deliveryUrl.value : null,
        };
      }),
  }));
}
