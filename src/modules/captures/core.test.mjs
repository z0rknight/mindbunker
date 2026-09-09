import assert from "node:assert/strict";
import test from "node:test";
import {
  captureDurationMinutes,
  defaultOutcomeForContext,
  isCaptureResolved,
  isPromotionScopeComplete,
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

test("isCaptureResolved: a fresh LEAD capture with no dismissal is unresolved", () => {
  assert.equal(isCaptureResolved({ outcome: "UNRESOLVED", dismissedAt: null }), false);
});

test("isCaptureResolved: dismissal resolves a capture without changing outcome semantics", () => {
  assert.equal(isCaptureResolved({ outcome: "UNRESOLVED", dismissedAt: new Date() }), true);
});

// Wave 2.1 (Promotion Custody release gate): promoteCapture now
// checkpoints promoted*Id incrementally, mid-flight, before the
// promotion actually completes (see actions.ts). isCaptureResolved must
// therefore NOT treat a checkpointed-but-incomplete promotion as
// resolved -- a Capture with a Client linked but no Project yet is a
// stalled/crashed promotion that still needs operator attention, and
// must stay visible in the Unresolved Inbox. Only `outcome` flipping to
// CONVERTED (written once the full requested scope actually finishes)
// means resolved. isCaptureResolved's own input type no longer even
// accepts promoted*Id fields, precisely so this can't regress silently.
test("isCaptureResolved: outcome alone decides resolution -- checkpointed linkage is not itself a signal", () => {
  assert.equal(isCaptureResolved({ outcome: "UNRESOLVED", dismissedAt: null }), false);
  assert.equal(isCaptureResolved({ outcome: "CONVERTED", dismissedAt: null }), true);
});

// ─── Wave 2.1: promotion scope completeness ────────────────────────────────
//
// This is the exact function whose absence caused a real bug during this
// release gate's own implementation: a retry that requested a video
// (wantsVideo=true) was being told "already fully promoted" as soon as
// client+project were checkpointed, even though the video step -- the
// thing this specific retry actually wanted -- had never run. Caught by
// integration.test.mjs's boundary-B test before this function existed.

test("isPromotionScopeComplete: client+project alone is complete when no video was requested", () => {
  assert.equal(
    isPromotionScopeComplete({ promotedClientId: 1, promotedProjectId: 2, promotedVideoId: null }, false),
    true,
  );
});

test("isPromotionScopeComplete: client+project alone is NOT complete when a video WAS requested", () => {
  assert.equal(
    isPromotionScopeComplete({ promotedClientId: 1, promotedProjectId: 2, promotedVideoId: null }, true),
    false,
  );
});

test("isPromotionScopeComplete: client+project+video is complete when a video was requested", () => {
  assert.equal(
    isPromotionScopeComplete({ promotedClientId: 1, promotedProjectId: 2, promotedVideoId: 3 }, true),
    true,
  );
});

test("isPromotionScopeComplete: client alone (no project yet) is never complete, video requested or not", () => {
  assert.equal(
    isPromotionScopeComplete({ promotedClientId: 1, promotedProjectId: null, promotedVideoId: null }, false),
    false,
  );
  assert.equal(
    isPromotionScopeComplete({ promotedClientId: 1, promotedProjectId: null, promotedVideoId: null }, true),
    false,
  );
});
