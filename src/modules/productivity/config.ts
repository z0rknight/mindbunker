export const VIDEO_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "DONE",
] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  READY_FOR_REVIEW: "Ready for review",
  CHANGES_REQUESTED: "Changes requested",
  DONE: "Done",
};

export const VIDEO_STATUS_TRANSITIONS: Record<
  VideoStatus,
  readonly VideoStatus[]
> = {
  PLANNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "DONE"],
  READY_FOR_REVIEW: ["CHANGES_REQUESTED", "DONE"],
  CHANGES_REQUESTED: ["IN_PROGRESS", "READY_FOR_REVIEW"],
  DONE: ["CHANGES_REQUESTED"],
};

export function isVideoStatus(value: unknown): value is VideoStatus {
  return (
    typeof value === "string" &&
    VIDEO_STATUSES.includes(value as VideoStatus)
  );
}

export function getAllowedVideoTransitions(status: VideoStatus) {
  return VIDEO_STATUS_TRANSITIONS[status];
}

export function isCompletedVideo(video: { status: VideoStatus }) {
  return video.status === "DONE";
}

export function deliveredForVideoStatus(status: VideoStatus) {
  return status === "DONE";
}

export function isVideoDirectlyFinishable(status: VideoStatus) {
  return status === "IN_PROGRESS" || status === "READY_FOR_REVIEW";
}

// --- Video visual metadata (Sprint 1.2.2 Client Portal round) -------------
//
// Orientation is the video's own physical shape -- independent of content
// type, since in principle a given piece of content could be delivered in
// either orientation. Nullable/unknown by default; never inferred, only
// ever set explicitly by the operator on the existing Video edit surface.
export const VIDEO_ORIENTATIONS = ["LANDSCAPE", "VERTICAL", "SQUARE"] as const;
export type VideoOrientation = (typeof VIDEO_ORIENTATIONS)[number];
export const VIDEO_ORIENTATION_LABELS: Record<VideoOrientation, string> = {
  LANDSCAPE: "Landscape (16:9)",
  VERTICAL: "Vertical (9:16)",
  SQUARE: "Square (1:1)",
};
export function isVideoOrientation(value: unknown): value is VideoOrientation {
  return (
    typeof value === "string" &&
    VIDEO_ORIENTATIONS.includes(value as VideoOrientation)
  );
}

// Content type vocabulary deliberately mirrors gateway/config.ts's
// SERVICE_INTEREST_OPTIONS values exactly (short-form/long-form/mini-doc/
// testimonial/other) -- the same real-world categories a lead already
// selects at intake, now available on the Video itself once produced. Two
// independent vocabularies for "what kind of content is this" would be its
// own kind of debt; this round chooses to share one instead of inventing a
// second. Nullable/unknown by default -- never backfilled by guessing from
// a title string.
export const VIDEO_CONTENT_TYPES = [
  "short-form",
  "long-form",
  "mini-doc",
  "testimonial",
  "other",
] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];
export const VIDEO_CONTENT_TYPE_LABELS: Record<VideoContentType, string> = {
  "short-form": "Short-form",
  "long-form": "Long-form",
  "mini-doc": "Mini-doc / Storytelling",
  testimonial: "Testimonial",
  other: "Other",
};
export function isVideoContentType(value: unknown): value is VideoContentType {
  return (
    typeof value === "string" &&
    VIDEO_CONTENT_TYPES.includes(value as VideoContentType)
  );
}
