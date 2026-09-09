// RMEDIA Engine — Operational Capture MVP (Wave 2). Pure logic only, no
// DB access -- same split this codebase already uses everywhere else
// (core.ts = pure/testable, actions.ts/data.ts = DB-touching).

import {
  CAPTURE_CONTEXTS,
  CAPTURE_EVENT_TYPES,
  CAPTURE_OUTCOMES,
  CAPTURE_TERMINAL_OUTCOMES,
  type CaptureContext,
  type CaptureEventType,
  type CaptureOutcome,
} from "./config.ts";

// Wave 1.5 Decision E: CLIENT/INTERNAL/ADMIN Captures default straight
// to NOT_APPLICABLE ("conversion" has no meaning for them) -- only LEAD
// starts UNRESOLVED and actually drives the Inbox. This is the one
// place that decision is encoded; every write path must call this
// rather than hard-coding "UNRESOLVED" as a default.
export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function defaultOutcomeForContext(context: CaptureContext): CaptureOutcome {
  return context === "LEAD" ? "UNRESOLVED" : "NOT_APPLICABLE";
}

export function isTerminalOutcome(outcome: CaptureOutcome): boolean {
  return (CAPTURE_TERMINAL_OUTCOMES as readonly CaptureOutcome[]).includes(outcome);
}

// Mission §4 / Wave 1.5 Decision E: GHOSTED must always be an explicit
// operator action, never inferred from elapsed time. This function
// exists so nothing in actions.ts can accidentally compute it from a
// date -- there is deliberately no "isStaleEnoughToGhost" helper here.
export const GHOSTING_IS_MANUAL_ONLY = true as const;

export type CreateCaptureInput = {
  context: CaptureContext;
  counterpartyLabel: string | null;
  channel: string | null;
  eventType: CaptureEventType;
  note: string | null;
  startedAt: string | null; // ISO instant
  endedAt: string | null; // ISO instant
  outcome?: CaptureOutcome | null; // omitted/null -> defaultOutcomeForContext(context)
  source?: string;
};

export type ValidatedCapture = {
  context: CaptureContext;
  counterpartyLabel: string | null;
  channel: string | null;
  eventType: CaptureEventType;
  note: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  outcome: CaptureOutcome;
  source: string;
};

export type CaptureValidationResult =
  | { success: true; data: ValidatedCapture }
  | { success: false; error: string };

const MAX_LABEL_LENGTH = 200;
const MAX_CHANNEL_LENGTH = 120;
const MAX_NOTE_LENGTH = 2_000;

function trimmedOrNull(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

// The only mandatory field is `context` -- everything else may be
// honestly unknown at capture time (Wave 1 §5: "answer WHAT HAPPENED
// without requiring the system to already know what permanent business
// entity this belongs to"). A Capture with every optional field empty
// is still a real, useful fact: "something LEAD-shaped happened, right
// now, and I don't have more detail yet."
export function validateCaptureInput(input: CreateCaptureInput): CaptureValidationResult {
  if (!CAPTURE_CONTEXTS.includes(input.context)) {
    return { success: false, error: "Choose a context." };
  }
  if (!CAPTURE_EVENT_TYPES.includes(input.eventType)) {
    return { success: false, error: "Choose an event type." };
  }

  const startedAt = input.startedAt ? new Date(input.startedAt) : null;
  const endedAt = input.endedAt ? new Date(input.endedAt) : null;
  if (startedAt && Number.isNaN(startedAt.getTime())) {
    return { success: false, error: "Invalid start time." };
  }
  if (endedAt && Number.isNaN(endedAt.getTime())) {
    return { success: false, error: "Invalid end time." };
  }
  if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
    return { success: false, error: "End time cannot be before start time." };
  }

  const requestedOutcome = input.outcome ?? null;
  if (requestedOutcome !== null && !CAPTURE_OUTCOMES.includes(requestedOutcome)) {
    return { success: false, error: "Invalid outcome." };
  }
  const outcome = requestedOutcome ?? defaultOutcomeForContext(input.context);

  return {
    success: true,
    data: {
      context: input.context,
      counterpartyLabel: trimmedOrNull(input.counterpartyLabel, MAX_LABEL_LENGTH),
      channel: trimmedOrNull(input.channel, MAX_CHANNEL_LENGTH),
      eventType: input.eventType,
      note: trimmedOrNull(input.note, MAX_NOTE_LENGTH),
      startedAt,
      endedAt,
      outcome,
      source: input.source?.trim() || "WEB_QUICK_CAPTURE",
    },
  };
}

// Duration in whole minutes, honestly null when either timestamp is
// missing -- a Capture is allowed to represent a point-in-time fact
// (e.g. "payment notification arrived") with no duration at all.
export function captureDurationMinutes(
  startedAt: Date | null,
  endedAt: Date | null,
): number | null {
  if (!startedAt || !endedAt) return null;
  const ms = endedAt.getTime() - startedAt.getTime();
  return ms > 0 ? Math.round(ms / 60_000) : 0;
}

export type CaptureResolutionInput = {
  outcome: CaptureOutcome;
  promotedClientId: number | null;
  promotedProjectId: number | null;
  promotedVideoId: number | null;
  promotedWorkSessionId: number | null;
  dismissedAt: Date | null;
};

// Mission §9: "resolved" = outcome is terminal, OR the Capture has been
// promoted/linked, OR it was explicitly dismissed. `dismissedAt` is a
// distinct disposition from the three outcome values -- "I'm choosing
// not to make a commercial call on this, just get it out of the Inbox"
// (e.g. a duplicate/mistaken Capture) -- so it is checked here alongside
// outcome/promotion rather than folded into REJECTED, which would make
// Dismiss and Reject the same action under different names (mission
// §8: "do not create redundant actions that mean the same thing").
export function isCaptureResolved(row: CaptureResolutionInput): boolean {
  return (
    isTerminalOutcome(row.outcome) ||
    row.promotedClientId !== null ||
    row.promotedProjectId !== null ||
    row.promotedVideoId !== null ||
    row.promotedWorkSessionId !== null ||
    row.dismissedAt !== null
  );
}
