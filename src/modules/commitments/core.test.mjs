import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCommitmentOverdue,
  sortCommitmentsByUrgency,
  validateNewCommitment,
  isCommitmentOwnerType,
} from "./core.ts";

function makeCommitment(overrides = {}) {
  return {
    id: 1,
    ownerType: "CLIENT",
    ownerId: 1,
    description: "test",
    dueAt: null,
    status: "OPEN",
    source: "MANUAL",
    actor: "admin",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}

test("isCommitmentOverdue: OPEN with past due date is overdue", () => {
  const c = makeCommitment({ dueAt: new Date("2026-08-01T00:00:00Z") });
  assert.equal(isCommitmentOverdue(c, new Date("2026-09-01T00:00:00Z")), true);
});

test("isCommitmentOverdue: OPEN with future due date is not overdue", () => {
  const c = makeCommitment({ dueAt: new Date("2026-12-01T00:00:00Z") });
  assert.equal(isCommitmentOverdue(c, new Date("2026-09-01T00:00:00Z")), false);
});

test("isCommitmentOverdue: OPEN with no due date is never overdue", () => {
  const c = makeCommitment({ dueAt: null });
  assert.equal(isCommitmentOverdue(c, new Date("2026-12-01T00:00:00Z")), false);
});

test("isCommitmentOverdue: DONE with past due date is not overdue -- resolved promises don't stay flagged", () => {
  const c = makeCommitment({
    status: "DONE",
    dueAt: new Date("2026-08-01T00:00:00Z"),
    completedAt: new Date("2026-08-05T00:00:00Z"),
  });
  assert.equal(isCommitmentOverdue(c, new Date("2026-09-01T00:00:00Z")), false);
});

test("isCommitmentOverdue: CANCELLED with past due date is not overdue", () => {
  const c = makeCommitment({ status: "CANCELLED", dueAt: new Date("2026-08-01T00:00:00Z") });
  assert.equal(isCommitmentOverdue(c, new Date("2026-09-01T00:00:00Z")), false);
});

test("sortCommitmentsByUrgency: overdue first, then soonest-due, then no-due-date", () => {
  const now = new Date("2026-09-01T00:00:00Z");
  const overdue = makeCommitment({ id: 1, dueAt: new Date("2026-08-01T00:00:00Z") });
  const soon = makeCommitment({ id: 2, dueAt: new Date("2026-09-05T00:00:00Z") });
  const later = makeCommitment({ id: 3, dueAt: new Date("2026-10-01T00:00:00Z") });
  const noDue = makeCommitment({ id: 4, dueAt: null });
  const sorted = sortCommitmentsByUrgency([noDue, later, overdue, soon], now);
  assert.deepEqual(sorted.map((c) => c.id), [1, 2, 3, 4]);
});

test("validateNewCommitment: rejects empty description", () => {
  const result = validateNewCommitment({
    ownerType: "CLIENT",
    ownerId: 1,
    description: "   ",
  });
  assert.equal(result.ok, false);
});

test("validateNewCommitment: rejects invalid owner type", () => {
  const result = validateNewCommitment({
    ownerType: "NOT_A_TYPE",
    ownerId: 1,
    description: "call client",
  });
  assert.equal(result.ok, false);
});

test("validateNewCommitment: rejects invalid due date string", () => {
  const result = validateNewCommitment({
    ownerType: "CLIENT",
    ownerId: 1,
    description: "call client",
    dueAtIso: "not-a-date",
  });
  assert.equal(result.ok, false);
});

test("validateNewCommitment: accepts valid input with no due date", () => {
  const result = validateNewCommitment({
    ownerType: "PROJECT",
    ownerId: 5,
    description: "send draft cut",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.description, "send draft cut");
    assert.equal(result.dueAt, null);
  }
});

test("isCommitmentOwnerType: rejects non-string and unknown values", () => {
  assert.equal(isCommitmentOwnerType(123), false);
  assert.equal(isCommitmentOwnerType("CLIENT"), true);
  assert.equal(isCommitmentOwnerType("client"), false);
});
