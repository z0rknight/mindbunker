import assert from "node:assert/strict";
import test from "node:test";
import { selectProductivityAttention } from "./attention.ts";

function signal(overrides) {
  return {
    id: "id",
    kind: "OVERDUE_PROMISE",
    severity: "ACTION",
    confidence: "HIGH",
    statement: "statement",
    evidence: "evidence",
    action: null,
    context: null,
    ...overrides,
  };
}

test("no signals means no groups", () => {
  assert.deepEqual(selectProductivityAttention([]), []);
});

test("financial/accounting signal kinds never appear in the Productivity projection", () => {
  const signals = [
    signal({ id: "cash-1", kind: "CASH_RECONCILIATION", severity: "WATCH" }),
    signal({ id: "rev-1", kind: "UNATTRIBUTED_REVENUE", severity: "INFO" }),
  ];
  assert.deepEqual(selectProductivityAttention(signals), []);
});

test("INFO severity is excluded even for an execution-relevant kind -- it never means 'act now' for these four kinds", () => {
  const signals = [
    signal({ id: "revision-drag", kind: "REVISION_DRAG", severity: "INFO" }),
  ];
  assert.deepEqual(selectProductivityAttention(signals), []);
});

test("multiple signals of the same kind are consolidated into one group with a count, not N separate items", () => {
  const signals = [
    signal({ id: "overdue-promise-1", kind: "OVERDUE_PROMISE", severity: "ACTION" }),
    signal({ id: "overdue-promise-2", kind: "OVERDUE_PROMISE", severity: "ACTION" }),
  ];
  const groups = selectProductivityAttention(signals);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "OVERDUE_PROMISE");
  assert.equal(groups[0].signals.length, 2);
});

test("groups are ordered ACTION before WATCH regardless of input order", () => {
  const signals = [
    signal({ id: "repeated-friction-FILES", kind: "REPEATED_FRICTION", severity: "WATCH" }),
    signal({ id: "open-blocker-1", kind: "OPEN_BLOCKER", severity: "ACTION" }),
  ];
  const groups = selectProductivityAttention(signals);
  assert.deepEqual(groups.map((group) => group.kind), ["OPEN_BLOCKER", "REPEATED_FRICTION"]);
});

test("group label is human language, never the raw signal kind", () => {
  const groups = selectProductivityAttention([signal({ kind: "OPEN_BLOCKER", severity: "ACTION" })]);
  assert.equal(groups[0].label, "Blocked");
  assert.notEqual(groups[0].label, "OPEN_BLOCKER");
});
