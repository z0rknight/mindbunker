// Client review flow (Train M2). A tiny presentation state machine around the
// EXISTING canonical action `transitionVideoStatusAsClient`. It owns no
// business truth:
//   - the domain decides READY_FOR_REVIEW -> DONE / CHANGES_REQUESTED;
//   - this only records "the request is in flight", "the server said yes",
//     or "the server said no", so the UI never shows Approved optimistically.
// Rules pinned by tests: submit only from `ready`; success/failure only from
// `submitting`; everything else is ignored (no double submit, no fake success).

export type ReviewTarget = "DONE" | "CHANGES_REQUESTED";
export type ReviewPhase = "ready" | "submitting" | "approved" | "changes_requested";

export type ReviewState = {
  phase: ReviewPhase;
  target: ReviewTarget | null;
  error: string | null;
};

export type ReviewEvent =
  | { type: "submit"; target: ReviewTarget }
  | { type: "succeeded" }
  | { type: "failed"; error: string };

export const INITIAL_REVIEW_STATE: ReviewState = { phase: "ready", target: null, error: null };

export const REVIEW_ERROR_FALLBACK =
  "We couldn’t save your response. Nothing has changed — please try again.";

export function reviewReducer(state: ReviewState, event: ReviewEvent): ReviewState {
  switch (event.type) {
    case "submit":
      if (state.phase !== "ready") return state;
      return { phase: "submitting", target: event.target, error: null };
    case "succeeded":
      if (state.phase !== "submitting" || !state.target) return state;
      return {
        phase: state.target === "DONE" ? "approved" : "changes_requested",
        target: state.target,
        error: null,
      };
    case "failed":
      if (state.phase !== "submitting") return state;
      return { phase: "ready", target: null, error: event.error || REVIEW_ERROR_FALLBACK };
    default:
      return state;
  }
}

/** Confirmed (server-true) outcome that should stay visible after the buttons go away. */
export function isAcknowledged(state: ReviewState): boolean {
  return state.phase === "approved" || state.phase === "changes_requested";
}

/** Text for the persistent polite live region (screen readers). */
export function reviewAnnouncement(state: ReviewState): string {
  if (state.phase === "approved") return "Approved. Your approval was saved.";
  if (state.phase === "changes_requested") return "Changes requested. Your request was sent.";
  if (state.phase === "ready" && state.error) return `Not saved. ${state.error}`;
  return "";
}

/** Visible acknowledgement copy (existing portal wording, shown only after server success). */
export function reviewAcknowledgement(state: ReviewState): { title: string; detail: string } | null {
  if (state.phase === "approved") return { title: "Approved — thank you!", detail: "Your approval is recorded." };
  if (state.phase === "changes_requested") return { title: "Changes requested.", detail: "Your note has been sent." };
  return null;
}
