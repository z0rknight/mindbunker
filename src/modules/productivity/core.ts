import {
  VIDEO_STATUS_TRANSITIONS,
  deliveredForVideoStatus,
  isVideoContentType,
  isVideoOrientation,
  isVideoStatus,
  type VideoContentType,
  type VideoOrientation,
  type VideoStatus,
} from "./config.ts";

export type VideoInputValues = {
  title: string;
  projectId?: number | null;
  clientId?: number | null;
  deliveryUrl?: string | null;
  notes?: string;
  coverUrl?: string | null;
  orientation?: VideoOrientation | null;
  contentType?: VideoContentType | null;
};

export type VideoCreateInputValues = VideoInputValues & {
  status: VideoStatus;
};

export type ValidatedVideoMetadata = {
  title: string;
  projectId: number | null;
  clientId: number | null;
  deliveryUrl: string | null;
  notes: string | null;
  coverUrl: string | null;
  orientation: VideoOrientation | null;
  contentType: VideoContentType | null;
};

type VideoInputResult =
  | {
      success: true;
      data: ValidatedVideoMetadata;
    }
  | { success: false; error: string };

type VideoCreateInputResult =
  | {
      success: true;
      data: ValidatedVideoMetadata & { status: "PLANNED" };
    }
  | { success: false; error: string };

export type VideoMetadataField =
  | "title"
  | "clientId"
  | "projectId"
  | "deliveryUrl"
  | "notes"
  | "coverUrl"
  | "orientation"
  | "contentType";

export type VideoLifecycleEventType =
  | "video.started"
  | "video.ready_for_review"
  | "video.changes_requested"
  | "video.finished"
  | "video.reopened";

export function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function optionalId(value: unknown) {
  return value === null || value === undefined || value === ""
    ? null
    : isPositiveId(value)
      ? value
      : undefined;
}

export function validateDeliveryUrl(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { success: true as const, value: null };
  }
  if (typeof value !== "string") {
    return { success: false as const, error: "Enter a valid HTTPS delivery URL." };
  }

  const candidate = value.trim();
  if (!candidate) {
    return { success: true as const, value: null };
  }
  if (candidate.length > 2_048) {
    return { success: false as const, error: "Delivery URL is too long." };
  }

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return { success: false as const, error: "Delivery URL must use HTTPS." };
    }
    return { success: true as const, value: url.toString() };
  } catch {
    return { success: false as const, error: "Enter a valid HTTPS delivery URL." };
  }
}

export function validateCoverUrl(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { success: true as const, value: null };
  }
  if (typeof value !== "string") {
    return { success: false as const, error: "Enter a valid HTTPS cover image URL." };
  }

  const candidate = value.trim();
  if (!candidate) {
    return { success: true as const, value: null };
  }
  if (candidate.length > 2_048) {
    return { success: false as const, error: "Cover image URL is too long." };
  }

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return { success: false as const, error: "Cover image URL must use HTTPS." };
    }
    return { success: true as const, value: url.toString() };
  } catch {
    return { success: false as const, error: "Enter a valid HTTPS cover image URL." };
  }
}

function validateOrientation(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { success: true as const, value: null };
  }
  if (!isVideoOrientation(value)) {
    return { success: false as const, error: "Choose a valid orientation." };
  }
  return { success: true as const, value };
}

function validateContentType(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { success: true as const, value: null };
  }
  if (!isVideoContentType(value)) {
    return { success: false as const, error: "Choose a valid content type." };
  }
  return { success: true as const, value };
}

export function validateVideoInput(values: VideoInputValues): VideoInputResult {
  const title = typeof values.title === "string"
    ? values.title.trim().slice(0, 180)
    : "";
  if (!title) return { success: false, error: "Video name is required." };

  const projectId = optionalId(values.projectId);
  const clientId = optionalId(values.clientId);
  if (projectId === undefined || clientId === undefined) {
    return { success: false, error: "Choose a valid project or client." };
  }

  const deliveryUrl = validateDeliveryUrl(values.deliveryUrl);
  if (!deliveryUrl.success) return deliveryUrl;

  const coverUrl = validateCoverUrl(values.coverUrl);
  if (!coverUrl.success) return coverUrl;

  const orientation = validateOrientation(values.orientation);
  if (!orientation.success) return orientation;

  const contentType = validateContentType(values.contentType);
  if (!contentType.success) return contentType;

  const notes = typeof values.notes === "string"
    ? values.notes.trim().slice(0, 2_000) || null
    : null;
  return {
    success: true,
    data: {
      title,
      projectId,
      clientId,
      deliveryUrl: deliveryUrl.value,
      notes,
      coverUrl: coverUrl.value,
      orientation: orientation.value,
      contentType: contentType.value,
    },
  };
}

export function validateVideoCreateInput(
  values: VideoCreateInputValues,
): VideoCreateInputResult {
  const metadata = validateVideoInput(values);
  if (!metadata.success) return metadata;
  if (!metadata.data.projectId) {
    return {
      success: false,
      error: "Choose an existing project before planning a video.",
    };
  }
  if (values.status !== "PLANNED") {
    return {
      success: false,
      error: "New videos must start as planned.",
    };
  }
  return {
    success: true,
    data: { ...metadata.data, status: "PLANNED" },
  };
}

export function getVideoMetadataChanges(
  current: ValidatedVideoMetadata,
  next: ValidatedVideoMetadata,
): VideoMetadataField[] {
  const fields: VideoMetadataField[] = [
    "title",
    "clientId",
    "projectId",
    "deliveryUrl",
    "notes",
    "coverUrl",
    "orientation",
    "contentType",
  ];
  return fields.filter((field) => current[field] !== next[field]);
}

export function validateVideoAssignment(input: {
  requestedClientId: number | null;
  projectId: number | null;
  project: { clientId: number; status: string } | null;
  allowArchivedProject?: boolean;
}) {
  if (!input.projectId) {
    return { success: true as const, clientId: input.requestedClientId };
  }
  if (!input.project) {
    return { success: false as const, error: "Project not found." };
  }
  if (input.project.status === "archived" && !input.allowArchivedProject) {
    return {
      success: false as const,
      error: "Choose a project that is not archived.",
    };
  }
  if (
    input.requestedClientId !== null &&
    input.requestedClientId !== input.project.clientId
  ) {
    return {
      success: false as const,
      error: "That project belongs to a different client.",
    };
  }
  return { success: true as const, clientId: input.project.clientId };
}

function lifecycleEventType(
  currentStatus: VideoStatus,
  targetStatus: VideoStatus,
): VideoLifecycleEventType {
  if (currentStatus === "DONE" && targetStatus === "CHANGES_REQUESTED") {
    return "video.reopened";
  }
  if (targetStatus === "IN_PROGRESS") return "video.started";
  if (targetStatus === "READY_FOR_REVIEW") {
    return "video.ready_for_review";
  }
  if (targetStatus === "CHANGES_REQUESTED") {
    return "video.changes_requested";
  }
  return "video.finished";
}

export function planVideoTransition(input: {
  currentStatus: unknown;
  expectedStatus: unknown;
  targetStatus: unknown;
}) {
  if (
    !isVideoStatus(input.currentStatus) ||
    !isVideoStatus(input.expectedStatus) ||
    !isVideoStatus(input.targetStatus)
  ) {
    return { success: false as const, error: "Invalid video status." };
  }
  if (input.currentStatus === input.targetStatus) {
    return {
      success: true as const,
      changed: false as const,
      status: input.currentStatus,
    };
  }
  if (input.currentStatus !== input.expectedStatus) {
    return {
      success: false as const,
      error: "This video changed elsewhere. Refresh and try again.",
    };
  }
  if (
    !VIDEO_STATUS_TRANSITIONS[input.currentStatus].includes(
      input.targetStatus,
    )
  ) {
    return {
      success: false as const,
      error: `Cannot move ${input.currentStatus} to ${input.targetStatus}.`,
    };
  }
  return {
    success: true as const,
    changed: true as const,
    status: input.targetStatus,
    delivered: deliveredForVideoStatus(input.targetStatus),
    eventType: lifecycleEventType(input.currentStatus, input.targetStatus),
  };
}

export function completedVideoLogs<T extends { status: VideoStatus }>(
  videos: readonly T[],
) {
  return videos.filter((video) => video.status === "DONE");
}

export type ProductivityGroup =
  | "current"
  | "attention"
  | "planned"
  | "completed";

export type OperationalVideo = {
  id: number;
  status: VideoStatus;
  projectDeadline: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

export type OperationalVideoEntry<T extends OperationalVideo> = T & {
  group: ProductivityGroup;
  isActiveSession: boolean;
  isOverdue: boolean;
  nextAction: string;
};

export type ProductivityGroups<T extends OperationalVideo> = Record<
  ProductivityGroup,
  Array<OperationalVideoEntry<T>>
>;

export function getVideoNextAction(status: VideoStatus) {
  const labels: Record<VideoStatus, string> = {
    PLANNED: "Start production",
    IN_PROGRESS: "Continue work",
    READY_FOR_REVIEW: "Review and decide",
    CHANGES_REQUESTED: "Apply requested changes",
    DONE: "Open delivery record",
  };
  return labels[status];
}

function operationalTimestamp(video: OperationalVideo) {
  const value = video.updatedAt ?? video.createdAt;
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function groupOperationalVideos<T extends OperationalVideo>(
  videos: readonly T[],
  options: { today: string; openSessionVideoId?: number | null },
): ProductivityGroups<T> {
  const groups: ProductivityGroups<T> = {
    current: [],
    attention: [],
    planned: [],
    completed: [],
  };

  for (const video of videos) {
    const isOverdue =
      video.status !== "DONE" &&
      Boolean(video.projectDeadline && video.projectDeadline < options.today);
    const isActiveSession = video.id === options.openSessionVideoId;
    const group: ProductivityGroup =
      video.status === "DONE"
        ? "completed"
        : video.status === "IN_PROGRESS"
          ? "current"
          : video.status === "READY_FOR_REVIEW" ||
              video.status === "CHANGES_REQUESTED" ||
              isOverdue
            ? "attention"
            : "planned";

    groups[group].push({
      ...video,
      group,
      isActiveSession,
      isOverdue,
      nextAction: getVideoNextAction(video.status),
    });
  }

  for (const entries of Object.values(groups)) {
    entries.sort((left, right) => {
      if (left.isActiveSession !== right.isActiveSession) {
        return left.isActiveSession ? -1 : 1;
      }
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }
      return operationalTimestamp(right) - operationalTimestamp(left);
    });
  }

  return groups;
}
