// Operator "resolve" flow (Train M3): the presentation state around an existing
// canonical action that takes an item out of a queue (approve / archive /
// delete a Sensor session, ...). Same rule as the client review flow: pending
// is not success; "resolved" only follows the server saying yes; a failure
// returns to idle with the message. It owns no business truth.

export type ResolvePhase = "idle" | "submitting" | "resolved";

export type ResolveState = { phase: ResolvePhase; action: string | null; error: string | null };
export type ResolveEvent =
  | { type: "submit"; action: string }
  | { type: "succeeded" }
  | { type: "failed"; error: string };

export const INITIAL_RESOLVE_STATE: ResolveState = { phase: "idle", action: null, error: null };
export const RESOLVE_ERROR_FALLBACK = "The change could not be saved. Nothing has changed.";
/** How long the confirmation stays before the revalidation removes the item. */
export const RESOLVE_HOLD_MS = 1200;

export function resolveReducer(state: ResolveState, event: ResolveEvent): ResolveState {
  switch (event.type) {
    case "submit":
      return state.phase === "idle" ? { phase: "submitting", action: event.action, error: null } : state;
    case "succeeded":
      return state.phase === "submitting" ? { phase: "resolved", action: state.action, error: null } : state;
    case "failed":
      return state.phase === "submitting"
        ? { phase: "idle", action: null, error: event.error || RESOLVE_ERROR_FALLBACK }
        : state;
    default:
      return state;
  }
}
