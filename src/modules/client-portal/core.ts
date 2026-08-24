import type {
  VideoContentType,
  VideoOrientation,
  VideoStatus,
} from "../productivity/config.ts";
import { VIDEO_CONTENT_TYPE_LABELS } from "../productivity/config.ts";
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
  reviewUrl: string | null;
  publishedUrl: string | null;
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
    reviewUrl: string | null;
    publishedUrl: string | null;
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
        const reviewUrl = validateDeliveryUrl(video.reviewUrl);
        const publishedUrl = validateDeliveryUrl(video.publishedUrl);
        return {
          title: video.title?.trim() || `Video ${video.date}`,
          status: CLIENT_VIDEO_STATUS_LABELS[video.status],
          lastUpdated: lastMeaningfulUpdate(video),
          deliveryUrl: deliveryUrl.success ? deliveryUrl.value : null,
          reviewUrl: reviewUrl.success ? reviewUrl.value : null,
          publishedUrl: publishedUrl.success ? publishedUrl.value : null,
        };
      }),
  }));
}


// --- Client Dashboard (Sprint 1.2.2 Client Portal Identity round) ---------
//
// Same defense-in-depth discipline as buildClientPortalProjects above:
// database queries are already scoped to the authenticated client, and this
// function re-derives ownership again and strips every field that isn't on
// the client-safe allowlist before anything reaches a page component.
//
// Deliberately expresses "current state" as counts + short lists rather
// than a raw dump of every video, and deliberately does NOT expose
// created-this-week or worked-on-this-week -- the former is easy to
// conflate with completed-this-week (the brief explicitly warns against
// this), and the latter is derived from work_sessions, which is
// operator-private data (labor/time-tracking) that must never cross this
// boundary regardless of how it's framed.

export type ClientDashboardVideoRow = {
  id: number;
  projectId: number | null;
  clientId: number | null;
  projectClientId: number;
  title: string | null;
  date: string;
  status: VideoStatus;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  coverUrl: string | null;
  orientation: VideoOrientation | null;
  contentType: VideoContentType | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * One row per `video.finished` crm_events entry -- i.e. the moment an
 * operator marked a video DONE. This is the only honest source for
 * "completed this week" / "recent deliveries": video_logs.updatedAt is
 * touched by ANY edit (including unrelated metadata fixes after delivery),
 * not just status transitions, so it cannot truthfully answer "when was
 * this completed." See CLIENT_VIDEO_STATUS_LABELS' DONE -> "Delivered"
 * mapping for the one open question this does NOT resolve: DONE means the
 * operator finished production, not that delivery to the client has been
 * separately confirmed. Documented, not resolved, this round (carried over
 * from the Sunday Systems Round report).
 */
export type ClientCompletionEventRow = {
  videoId: number | null;
  createdAt: Date | null;
};

export type ClientDashboardVideoCard = {
  id: number;
  title: string;
  status: VideoStatus;
  statusLabel: string;
  projectName: string | null;
  contentType: VideoContentType | null;
  contentTypeLabel: string | null;
  orientation: VideoOrientation | null;
  coverUrl: string | null;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  lastUpdated: string | null;
};

export type ClientDashboard = {
  activeProjectsCount: number;
  totalVideos: number;
  totals: {
    completed: number;
    inProduction: number;
    readyForReview: number;
  };
  completedThisWeek: number;
  currentWork: ClientDashboardVideoCard[];
  readyForReview: ClientDashboardVideoCard[];
  recentDeliveries: Array<ClientDashboardVideoCard & { deliveredAt: string | null }>;
  allVideos: ClientDashboardVideoCard[];
  contentBreakdown: Array<{
    contentType: VideoContentType;
    label: string;
    completedCount: number;
  }>;
  unclassifiedCompletedCount: number;
};

function toCard(
  video: ClientDashboardVideoRow,
  projectNameById: Map<number, string>,
): ClientDashboardVideoCard {
  const deliveryUrl = validateDeliveryUrl(video.deliveryUrl);
  const reviewUrl = validateDeliveryUrl(video.reviewUrl);
  const publishedUrl = validateDeliveryUrl(video.publishedUrl);
  const coverUrl = validateDeliveryUrl(video.coverUrl);
  const updated = video.updatedAt ?? video.createdAt;
  return {
    id: video.id,
    title: video.title?.trim() || `Video ${video.date}`,
    status: video.status,
    statusLabel: CLIENT_VIDEO_STATUS_LABELS[video.status],
    projectName: video.projectId ? (projectNameById.get(video.projectId) ?? null) : null,
    contentType: video.contentType,
    contentTypeLabel: video.contentType
      ? VIDEO_CONTENT_TYPE_LABELS[video.contentType]
      : null,
    orientation: video.orientation,
    coverUrl: coverUrl.success ? coverUrl.value : null,
    deliveryUrl: deliveryUrl.success ? deliveryUrl.value : null,
    reviewUrl: reviewUrl.success ? reviewUrl.value : null,
    publishedUrl: publishedUrl.success ? publishedUrl.value : null,
    lastUpdated:
      updated instanceof Date && !Number.isNaN(updated.getTime())
        ? updated.toISOString()
        : null,
  };
}

function startOfWeekUTC(now: Date) {
  // Monday-anchored week, matching the rest of the app's ISO-week
  // conventions (see src/utils/date.ts). Computed in UTC to avoid the
  // React-Compiler-forbidden Date.now()/local-timezone drift issue that
  // bit an earlier round -- callers pass `now` in explicitly.
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday;
}

export function buildClientDashboard(
  authenticatedClientId: number,
  projectRows: readonly ClientPortalProjectRow[],
  videoRows: readonly ClientDashboardVideoRow[],
  completionEvents: readonly ClientCompletionEventRow[],
  now: Date,
): ClientDashboard {
  const ownedProjects = projectRows.filter(
    (project) => project.clientId === authenticatedClientId,
  );
  const projectNameById = new Map(
    ownedProjects.map((project) => [project.id, project.name]),
  );
  const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));

  const ownedVideos = videoRows.filter(
    (video) =>
      video.clientId === authenticatedClientId &&
      video.projectClientId === authenticatedClientId &&
      (video.projectId === null || ownedProjectIds.has(video.projectId)),
  );
  const ownedVideoIds = new Set(ownedVideos.map((video) => video.id));

  const inProduction = ownedVideos.filter(
    (video) => video.status === "IN_PROGRESS" || video.status === "CHANGES_REQUESTED",
  );
  const readyForReview = ownedVideos.filter(
    (video) => video.status === "READY_FOR_REVIEW",
  );
  const completed = ownedVideos.filter((video) => video.status === "DONE");

  const currentlyCompletedVideoIds = new Set(completed.map((video) => video.id));
  const weekStart = startOfWeekUTC(now);
  const relevantCompletionEvents = completionEvents.filter(
    (event) =>
      event.videoId !== null &&
      ownedVideoIds.has(event.videoId) &&
      currentlyCompletedVideoIds.has(event.videoId),
  );
  const completedThisWeekVideoIds = new Set(
    relevantCompletionEvents
      .filter((event) => (event.createdAt?.getTime() ?? 0) >= weekStart.getTime())
      .map((event) => event.videoId as number),
  );

  const videoById = new Map(ownedVideos.map((video) => [video.id, video]));
  const recentDeliveries = relevantCompletionEvents
    .toSorted((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 5)
    .map((event) => {
      const video = event.videoId !== null ? videoById.get(event.videoId) : undefined;
      if (!video) return null;
      return {
        ...toCard(video, projectNameById),
        deliveredAt:
          event.createdAt instanceof Date && !Number.isNaN(event.createdAt.getTime())
            ? event.createdAt.toISOString()
            : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const contentBreakdownCounts = new Map<VideoContentType, number>();
  let unclassifiedCompletedCount = 0;
  for (const video of completed) {
    if (video.contentType) {
      contentBreakdownCounts.set(
        video.contentType,
        (contentBreakdownCounts.get(video.contentType) ?? 0) + 1,
      );
    } else {
      unclassifiedCompletedCount += 1;
    }
  }

  return {
    activeProjectsCount: ownedProjects.filter((project) => project.status === "active")
      .length,
    totalVideos: ownedVideos.length,
    totals: {
      completed: completed.length,
      inProduction: inProduction.length,
      readyForReview: readyForReview.length,
    },
    completedThisWeek: completedThisWeekVideoIds.size,
    currentWork: inProduction
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById)),
    readyForReview: readyForReview
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById)),
    recentDeliveries,
    allVideos: ownedVideos
      .toSorted((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
      .map((video) => toCard(video, projectNameById)),
    contentBreakdown: Array.from(contentBreakdownCounts.entries()).map(
      ([contentType, completedCount]) => ({
        contentType,
        label: VIDEO_CONTENT_TYPE_LABELS[contentType],
        completedCount,
      }),
    ),
    unclassifiedCompletedCount,
  };
}

export function filterClientDashboardVideos(
  videos: readonly ClientDashboardVideoCard[],
  contentType: "all" | VideoContentType,
) {
  return contentType === "all"
    ? [...videos]
    : videos.filter((video) => video.contentType === contentType);
}
