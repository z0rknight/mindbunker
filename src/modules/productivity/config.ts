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
