import assert from "node:assert/strict";
import test from "node:test";
import {
  computeOverduePromiseSignals,
  computeOpenBlockerSignals,
  computeRepeatedFrictionSignals,
  computeRevisionDragSignal,
  computeCashReconciliationSignals,
  computeUnattributedRevenueSignals,
  rankOpenCommitments,
} from "./core.ts";

test("an overdue commitment produces an ACTION/HIGH signal; a not-yet-due one does not", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  const rows = [
    { id: 1, title: "Deliver cut", dueAt: new Date("2026-09-01T12:00:00Z"), videoId: 10, videoTitle: "Cut", clientName: "Acme", projectName: null },
    { id: 2, title: "Future promise", dueAt: new Date("2026-09-05T12:00:00Z"), videoId: 11, videoTitle: "Other", clientName: null, projectName: null },
  ];
  const signals = computeOverduePromiseSignals(rows, now);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "ACTION");
  assert.equal(signals[0].confidence, "HIGH");
  assert.match(signals[0].statement, /overdue by/);
});

test("rankOpenCommitments puts every overdue item before every upcoming item, most-overdue first", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const rows = [
    { id: 1, title: "Upcoming soon", dueAt: new Date("2026-09-09T12:00:00Z"), videoId: 1, videoTitle: null, clientName: null, projectName: null },
    { id: 2, title: "Overdue by 1 day", dueAt: new Date("2026-09-07T12:00:00Z"), videoId: 2, videoTitle: null, clientName: null, projectName: null },
    { id: 3, title: "Upcoming later", dueAt: new Date("2026-09-12T12:00:00Z"), videoId: 3, videoTitle: null, clientName: null, projectName: null },
    { id: 4, title: "Overdue by 3 days", dueAt: new Date("2026-09-05T12:00:00Z"), videoId: 4, videoTitle: null, clientName: null, projectName: null },
  ];
  const ranked = rankOpenCommitments(rows, now);
  assert.deepEqual(ranked.map((r) => r.id), [4, 2, 1, 3]);
});

test("rankOpenCommitments with no rows returns an empty array", () => {
  assert.deepEqual(rankOpenCommitments([], new Date()), []);
});

test("no open blockers means no blocker signals -- healthy facts produce no false signal", () => {
  assert.deepEqual(computeOpenBlockerSignals([], new Date()), []);
});

test("an open blocker is always ACTION/HIGH -- no arbitrary duration threshold", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  const rows = [
    { id: 1, category: "FILES", note: "missing project files", startedAt: new Date("2026-09-02T11:00:00Z"), videoId: 5, videoTitle: "Video", clientName: "Client" },
  ];
  const signals = computeOpenBlockerSignals(rows, now);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "ACTION");
  assert.equal(signals[0].confidence, "HIGH");
});

test("repeated friction fires only at or above the stated operator rule (3 occurrences / 2 videos)", () => {
  const belowThreshold = [
    { category: "FILES", videoId: 1 },
    { category: "FILES", videoId: 1 },
  ];
  assert.deepEqual(computeRepeatedFrictionSignals(belowThreshold), []);

  const sameVideoOnly = [
    { category: "FILES", videoId: 1 },
    { category: "FILES", videoId: 1 },
    { category: "FILES", videoId: 1 },
  ];
  assert.deepEqual(computeRepeatedFrictionSignals(sameVideoOnly), [], "3 occurrences on one video should not fire -- needs 2+ distinct videos");

  const atThreshold = [
    { category: "FILES", videoId: 1 },
    { category: "FILES", videoId: 2 },
    { category: "FILES", videoId: 2 },
  ];
  const signals = computeRepeatedFrictionSignals(atThreshold);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "WATCH");
  assert.equal(signals[0].confidence, "MEDIUM");
  assert.match(signals[0].evidence, /operator rule/);
});

test("revision drag reports INSUFFICIENT below the minimum sample, not a fabricated rate", () => {
  const fewRows = [
    { causedBy: "OUR_ERROR", videoId: 1 },
    { causedBy: "CLIENT_CHANGE", videoId: 2 },
  ];
  const signal = computeRevisionDragSignal(fewRows);
  assert.equal(signal.confidence, "INSUFFICIENT");
  assert.equal(signal.severity, "INFO");
  assert.match(signal.statement, /Not enough/);
});

test("revision drag reports a real MEDIUM-confidence rate once the sample is large enough", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    causedBy: i < 4 ? "OUR_ERROR" : "CLIENT_CHANGE",
    videoId: i,
  }));
  const signal = computeRevisionDragSignal(rows);
  assert.equal(signal.confidence, "MEDIUM");
  assert.match(signal.statement, /40% of recorded revisions are OUR_ERROR/);
});

test("cash reconciliation only surfaces a currency with a real nonzero difference", () => {
  const rows = [
    { currency: "USD", difference: 0 },
    { currency: "BRL", difference: 42.5 },
    { currency: "EUR", difference: null },
  ];
  const signals = computeCashReconciliationSignals(rows);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].id, "cash-reconciliation-BRL");
});

test("unattributed revenue keeps currencies separate and skips zero/negative amounts", () => {
  const rows = [
    { currency: "USD", amount: 150 },
    { currency: "BRL", amount: 0 },
  ];
  const signals = computeUnattributedRevenueSignals(rows);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].id, "unattributed-revenue-USD");
});
