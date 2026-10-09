import type { VideoStatus } from "./config";

export type VideoWorkspaceStatePresentation = {
  eyebrow: string;
  headline: string;
  guidance: string;
  tone: "neutral" | "active" | "review" | "changes" | "done";
  reviewIsPrimary: boolean;
  deliveryIsPrimary: boolean;
};

export function getVideoWorkspaceStatePresentation(
  status: VideoStatus,
): VideoWorkspaceStatePresentation {
  switch (status) {
    case "PLANNED":
      return {
        eyebrow: "Current state",
        headline: "Ready to start",
        guidance: "Confirm the Recipe, then begin intentional work.",
        tone: "neutral",
        reviewIsPrimary: false,
        deliveryIsPrimary: false,
      };
    case "IN_PROGRESS":
      return {
        eyebrow: "Happening now",
        headline: "Making in progress",
        guidance: "Keep the Recipe current. Review is the next lifecycle gate.",
        tone: "active",
        reviewIsPrimary: false,
        deliveryIsPrimary: false,
      };
    case "READY_FOR_REVIEW":
      return {
        eyebrow: "Needs review",
        headline: "Awaiting a review decision",
        guidance: "Open the review link, then decide: changes requested or done.",
        tone: "review",
        reviewIsPrimary: true,
        deliveryIsPrimary: false,
      };
    case "CHANGES_REQUESTED":
      return {
        eyebrow: "Action required",
        headline: "Changes requested",
        guidance: "Capture the requested change, reopen the relevant Recipe step, then return to review.",
        tone: "changes",
        reviewIsPrimary: true,
        deliveryIsPrimary: false,
      };
    case "DONE":
      return {
        eyebrow: "Current state",
        headline: "Execution complete",
        guidance: "Delivery, Quality Evidence and history are now the useful record.",
        tone: "done",
        reviewIsPrimary: false,
        deliveryIsPrimary: true,
      };
  }
}
