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
  // §5/§6: provider-independent review and publish links -- see the
  // reviewUrl column comment in db/schema.ts.
  reviewUrl?: string | null;
  publishedUrl?: string | null;
  notes?: string;
  coverUrl?: string | null;
  orientation?: VideoOrientation | null;
  contentType?: VideoContentType | null;
  // Taryn August Ingest Readiness §6: an optional historical date
  // (YYYY-MM-DD), only meaningful at creation. Undefined/null means "use
  // today", exactly the previous hardcoded behavior -- existing callers
  // (PlanVideoButton, NewWorkButton) never set this and are unaffected.
  // Needed so bulk/manual ingest of already-completed August work is
  // dated when it actually happened, not the day it's typed in.
  date?: string | null;
};

export type VideoCreateInputValues = VideoInputValues & {
  status: VideoStatus;
  // Brief C ("Final Local Ingest / Live Readiness") §3: historical bulk
  // ingest must be allowed to create a Video directly in a later canonical
  // lifecycle state (some of August's real work is already Delivered, not
  // freshly Planned). Defaults to false/undefined everywhere except the
  // explicit bulk/historical create path in actions.ts -- NORMAL prospective
  // single-video creation keeps defaulting to PLANNED-only, unchanged. This
  // flag is never read from client input directly; only the bulk action sets
  // it, and only after the row already carries an explicit, validated status
  // value (never inferred from absence).
  allowExplicitStatus?: boolean;
};

export type ValidatedVideoMetadata = {
  title: string;
  projectId: number | null;
  clientId: number | null;
  deliveryUrl: string | null;
  reviewUrl: string | null;
  publishedUrl: string | null;
  notes: string | null;
  coverUrl: string | null;
  orientation: VideoOrientation | null;
  contentType: VideoContentType | null;
  date?: string | null;
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
      data: ValidatedVideoMetadata & { status: VideoStatus };
    }
  | { success: false; error: string };

export type VideoMetadataField =
  | "title"
  | "clientId"
  | "projectId"
  | "deliveryUrl"
  | "reviewUrl"
  | "publishedUrl"
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

  // reviewUrl/publishedUrl reuse the exact same HTTPS-only validator as
  // deliveryUrl -- provider-independent, same discipline.
  const reviewUrl = validateDeliveryUrl(values.reviewUrl);
  if (!reviewUrl.success) return reviewUrl;

  const publishedUrl = validateDeliveryUrl(values.publishedUrl);
  if (!publishedUrl.success) return publishedUrl;

  const coverUrl = validateCoverUrl(values.coverUrl);
  if (!coverUrl.success) return coverUrl;

  const orientation = validateOrientation(values.orientation);
  if (!orientation.success) return orientation;

  const contentType = validateContentType(values.contentType);
  if (!contentType.success) return contentType;

  const notes = typeof values.notes === "string"
    ? values.notes.trim().slice(0, 2_000) || null
    : null;

  let date: string | null = null;
  if (values.date !== undefined && values.date !== null && values.date !== "") {
    if (typeof values.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(Date.parse(values.date))) {
      return { success: false, error: "Enter a valid date (YYYY-MM-DD)." };
    }
    date = values.date;
  }

  return {
    success: true,
    data: {
      title,
      projectId,
      clientId,
      deliveryUrl: deliveryUrl.value,
      reviewUrl: reviewUrl.value,
      publishedUrl: publishedUrl.value,
      notes,
      coverUrl: coverUrl.value,
      orientation: orientation.value,
      contentType: contentType.value,
      date,
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
  // Brief C §3: two distinct create paths, one invariant each.
  // - NORMAL prospective single-video creation (allowExplicitStatus unset/
  //   false): unchanged from every prior round -- must start PLANNED.
  // - EXPLICIT historical/bulk ingest (allowExplicitStatus true): may
  //   specify any canonical VideoStatus, but the value must still be an
  //   explicit, valid member of VIDEO_STATUSES. Absence of a valid status
  //   is always rejected here, never silently defaulted to a completed
  //   state -- the bulk-ingest UI is responsible for supplying an explicit
  //   status (its own safe default is PLANNED, not inferred completion).
  if (!values.allowExplicitStatus) {
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
  if (!isVideoStatus(values.status)) {
    return {
      success: false,
      error: "Choose a valid video status for this batch.",
    };
  }
  // Single Historical Video Ingest Gap round: the same "no
  // AWAITING_CLIENT_APPROVAL without a review URL" invariant enforced on
  // status TRANSITIONS (planVideoTransition, below) must also hold when an
  // explicit historical/bulk create targets READY_FOR_REVIEW directly --
  // otherwise a Video could be born in that state with no review link,
  // exactly the semantically-invalid state the transition check exists to
  // prevent. Not a new rule, just the existing one applied at the one
  // create path that can now reach that status without going through a
  // transition first.
  if (values.status === "READY_FOR_REVIEW" && !(metadata.data.reviewUrl && metadata.data.reviewUrl.trim())) {
    return {
      success: false,
      error: "A review link is required before a video can be marked Ready for review.",
    };
  }
  return {
    success: true,
    data: { ...metadata.data, status: values.status },
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
    "reviewUrl",
    "publishedUrl",
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

// Monday Real-Operation Pre-Freeze §5: "A video/work unit may ONLY enter
// AWAITING_CLIENT_APPROVAL if a valid review URL exists." READY_FOR_REVIEW
// is this repo's existing name for that concept (see VIDEO_STATUS_TRANSITIONS
// above) -- reviewUrl is the video's CURRENT reviewUrl (or one supplied in
// the same request that also sets the URL, see actions.ts), never inferred
// or defaulted. Enforced here (app layer) rather than as a DB CHECK
// constraint -- see the reviewUrl column comment in db/schema.ts for why
// D1 can't host that CHECK on this particular table.
export function planVideoTransition(input: {
  currentStatus: unknown;
  expectedStatus: unknown;
  targetStatus: unknown;
  reviewUrl?: string | null;
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
  if (
    input.targetStatus === "READY_FOR_REVIEW" &&
    !(input.reviewUrl && input.reviewUrl.trim())
  ) {
    return {
      success: false as const,
      error:
        "A review link is required before a video can be marked Ready for review.",
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
