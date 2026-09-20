// Presentation-attribute helpers for the RMEDIA OS feedback primitives
// (Train M1). They map *supplied* presentation inputs to stable data/aria
// attributes. They never derive or invent a business state.

/** Tones the UpdateFlash pattern supports. Error is deliberately absent: an
 *  error is a static state (text + edge), never an animated one. */
export const FLASH_TONES = ["success", "brand", "warning"] as const;
export type FlashTone = (typeof FLASH_TONES)[number];

export const STATUS_TONES = ["neutral", "brand", "success", "warning", "danger", "pending"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];
export const STATUS_MARKERS = ["dot", "check", "none"] as const;
export type StatusMarker = (typeof STATUS_MARKERS)[number];

export function statusTransitionAttrs(input: {
  tone?: StatusTone;
  marker?: StatusMarker;
  status?: string;
}): Record<string, string | undefined> {
  return {
    "data-tone": input.tone ?? "neutral",
    "data-marker": input.marker ?? "dot",
    "data-status": input.status,
  };
}

export type ActionState = "idle" | "pending" | "loading" | "success" | "error";

/**
 * pending  = the action is in flight (truth for aria/double-submit guard)
 * loading  = the delayed, flicker-free visual indicator (from the pending gate)
 * state    = optional caller-supplied outcome ("success" | "error"); the
 *            button never decides success itself.
 * aria-disabled (not `disabled`) is used while pending so keyboard focus is
 * kept; a real `disabled` is only ever the caller's own.
 */
export function actionButtonAttrs(input: {
  pending: boolean;
  loading: boolean;
  state?: "idle" | "success" | "error";
  disabled?: boolean;
}): { "data-state": ActionState; "aria-busy"?: true; "aria-disabled"?: true; disabled?: true } {
  const dataState: ActionState = input.loading
    ? "loading"
    : input.pending
      ? "pending"
      : input.state === "success" || input.state === "error"
        ? input.state
        : "idle";
  return {
    "data-state": dataState,
    ...(input.pending ? { "aria-busy": true as const, "aria-disabled": true as const } : {}),
    ...(input.disabled ? { disabled: true as const } : {}),
  };
}
