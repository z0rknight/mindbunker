import assert from "node:assert/strict";
import test from "node:test";
import { validateRecordDecisionInput, validateResultInput } from "./core.ts";

test("a decision requires non-empty text", () => {
  const result = validateRecordDecisionInput({ decision: "   " });
  assert.equal(result.success, false);
});

test("a valid decision with context and a review date parses cleanly", () => {
  const result = validateRecordDecisionInput({
    signalType: "REPEATED_FRICTION",
    videoId: 5,
    decision: "  Request complete source package before edit starts.  ",
    reviewAt: "2026-09-20",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.decision, "Request complete source package before edit starts.");
    assert.equal(result.data.signalType, "REPEATED_FRICTION");
    assert.equal(result.data.videoId, 5);
    assert.equal(result.data.clientId, null);
    assert.deepEqual(result.data.reviewAt, new Date("2026-09-20"));
  }
});

test("a decision with no context and no review date is still valid -- both are optional", () => {
  const result = validateRecordDecisionInput({ decision: "Follow up next week." });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.videoId, null);
    assert.equal(result.data.reviewAt, null);
  }
});

test("an invalid review date is rejected", () => {
  const result = validateRecordDecisionInput({ decision: "x", reviewAt: "not-a-date" });
  assert.equal(result.success, false);
});

test("a result requires non-empty text", () => {
  assert.equal(validateResultInput("").success, false);
  assert.equal(validateResultInput("   ").success, false);
  assert.equal(validateResultInput("Worked on the next 3 videos.").success, true);
});
