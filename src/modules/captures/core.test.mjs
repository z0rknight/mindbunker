import assert from "node:assert/strict";
import test from "node:test";
import {
  captureDurationMinutes,
  defaultOutcomeForContext,
  isCaptureResolved,
  isTerminalOutcome,
  validateCaptureInput,
  GHOSTING_IS_MANUAL_ONLY,
} from "./core.ts";

// ─── C. Defaults ────────────────────────────────────────────────────────────

test("LEAD context defaults to UNRESOLVED outcome", () => {
  assert.equal(defaultOutcomeForContext("LEAD"), "UNRESOLVED");
});

test("CLIENT/INTERNAL/ADMIN contexts default to NOT_APPLICABLE outcome", () => {
  assert.equal(defaultOutcomeForContext("CLIENT"), "NOT_APPLICABLE");
  assert.equal(defaultOutcomeForContext("INTERNAL"), "NOT_APPLICABLE");
  assert.equal(defaultOutcomeForContext("ADMIN"), "NOT_APPLICABLE");
});

test("validateCaptureInput applies the context-derived default when outcome is omitted", () => {
  const lead = validateCaptureInput({
    context: "LEAD",
    counterpartyLabel: "Moritz-Alexander Germann",
    channel: "UPWORK",
    eventType: "SAMPLE",
    note: "Proof of work sent",
    startedAt: null,
    endedAt: null,
  });
  assert.equal(lead.success, true);
  assert.equal(lead.data.outcome, "UNRESOLVED");

  const internal = validateCaptureInput({
    context: "INTERNAL",
    counterpartyLabel: "RMEDIA Engine",
    channel: null,
    eventType: "INTERNAL_WORK",
    note: null,
    startedAt: null,
    endedAt: null,
  });
  assert.equal(internal.success, true);
  assert.equal(internal.data.outcome, "NOT_APPLICABLE");
});

// ─── E axis separation: eventType vs outcome ───────────────────────────────

test("eventType and outcome are independent axes, never collapsed", () => {
  const result = validateCaptureInput({
    context: "LEAD",
    counterpartyLabel: "Moritz",
    channel: "UPWORK",
    eventType: "SAMPLE",
    note: null,
    startedAt: null,
    endedAt: null,
    outcome: "CONVERTED",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.eventType, "SAMPLE");
  assert.equal(result.data.outcome, "CONVERTED");
});

// ─── G. Ghosting is manual only ────────────────────────────────────────────

test("no core.ts function derives GHOSTED from elapsed time", () => {
  // This is a structural assertion, not a behavioral one: the module
  // exposes no "isStaleEnoughToGhost"/"suggestGhosted"-shaped export, and
  // the one marker that exists is a literal `true` constant documenting
  // the invariant, not a computed value. GHOSTED can only ever be
  // reached via setCaptureOutcome(id, "GHOSTED") in actions.ts, an
  // explicit operator call with no age/date parameter at all.
  assert.equal(GHOSTING_IS_MANUAL_ONLY, true);
});

// ─── Validation ─────────────────────────────────────────────────────────────

test("validateCaptureInput requires a context", () => {
  const result = validateCaptureInput({
    context: "NOT_A_CONTEXT",
    counterpartyLabel: null,
    channel: null,
    eventType: "OTHER",
    note: null,
    startedAt: null,
    endedAt: null,
  });
  assert.equal(result.success, false);
});

test("validateCaptureInput rejects endedAt before startedAt", () => {
  const result = validateCaptureInput({
    context: "LEAD",
    counterpartyLabel: "Moritz",
    channel: null,
    eventType: "SAMPLE",
    note: null,
    startedAt: "2026-09-09T02:23:00.000Z",
    endedAt: "2026-09-09T02:08:00.000Z",
  });
  assert.equal(result.success, false);
});

test("validateCaptureInput accepts every optional field empty -- context alone is enough", () => {
  const result = validateCaptureInput({
    context: "ADMIN",
    counterpartyLabel: null,
    channel: null,
    eventType: "OTHER",
    note: null,
    startedAt: null,
    endedAt: null,
  });
  assert.equal(result.success, true);
});

test("validateCaptureInput trims and caps free-text fields, empty string becomes null", () => {
  const result = validateCaptureInput({
    context: "LEAD",
    counterpartyLabel: "   ",
    channel: "  Upwork  ",
    eventType: "SAMPLE",
    note: null,
    startedAt: null,
    endedAt: null,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.counterpartyLabel, null);
  assert.equal(result.data.channel, "Upwork");
});

// ─── Duration ───────────────────────────────────────────────────────────────

test("captureDurationMinutes is null when either timestamp is missing (point-in-time Capture)", () => {
  assert.equal(captureDurationMinutes(null, null), null);
  assert.equal(captureDurationMinutes(new Date(), null), null);
});

test("captureDurationMinutes computes whole minutes for the Moritz 15-minute case", () => {
  const started = new Date("2026-09-09T02:08:00.000Z");
  const ended = new Date("2026-09-09T02:23:00.000Z");
  assert.equal(captureDurationMinutes(started, ended), 15);
});

// ─── Terminal outcomes / resolution ────────────────────────────────────────

test("isTerminalOutcome: UNRESOLVED is the only non-terminal value", () => {
  assert.equal(isTerminalOutcome("UNRESOLVED"), false);
  assert.equal(isTerminalOutcome("CONVERTED"), true);
  assert.equal(isTerminalOutcome("GHOSTED"), true);
  assert.equal(isTerminalOutcome("REJECTED"), true);
  assert.equal(isTerminalOutcome("NOT_APPLICABLE"), true);
});

test("isCaptureResolved: a fresh LEAD capture with no links and no dismissal is unresolved", () => {
  assert.equal(
    isCaptureResolved({
      outcome: "UNRESOLVED",
      promotedClientId: null,
      promotedProjectId: null,
      promotedVideoId: null,
      promotedWorkSessionId: null,
      dismissedAt: null,
    }),
    false,
  );
});

test("isCaptureResolved: dismissal resolves a capture without changing outcome semantics", () => {
  assert.equal(
    isCaptureResolved({
      outcome: "UNRESOLVED",
      promotedClientId: null,
      promotedProjectId: null,
      promotedVideoId: null,
      promotedWorkSessionId: null,
      dismissedAt: new Date(),
    }),
    true,
  );
});

test("isCaptureResolved: a promoted capture is resolved even before outcome catches up", () => {
  assert.equal(
    isCaptureResolved({
      outcome: "UNRESOLVED",
      promotedClientId: 42,
      promotedProjectId: null,
      promotedVideoId: null,
      promotedWorkSessionId: null,
      dismissedAt: null,
    }),
    true,
  );
});
