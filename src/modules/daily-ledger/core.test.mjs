import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyLedger } from "./core.ts";

const identityCaffeine = (manualMg, servings) => {
  if (manualMg === null && servings <= 0) return null;
  return manualMg ?? servings * 90;
};

function emptyFacts(overrides = {}) {
  return {
    health: [],
    caffeineEvents: [],
    workSessions: [],
    deliveries: [],
    commitments: [],
    revisions: [],
    friction: [],
    blockers: [],
    transactions: [],
    ...overrides,
  };
}

test("a day with zero evidence anywhere still gets a row, all null/zero", () => {
  const rows = buildDailyLedger(["2026-08-30"], emptyFacts(), identityCaffeine);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].capacity, {
    sleepHours: null,
    caffeineMg: null,
    walkingMinutes: null,
    cyclingKm: null,
  });
  assert.equal(rows[0].work.trackedSeconds, 0);
  assert.equal(rows[0].work.sessionCount, 0);
  assert.equal(rows[0].quality.reworkMinutes, null);
});

test("missing is not zero: a Health row with an explicit 0 stays 0, absence stays null", () => {
  const rows = buildDailyLedger(
    ["2026-08-30", "2026-08-31"],
    emptyFacts({
      health: [
        { date: "2026-08-30", sleepHours: null, caffeineMg: null, walkingMinutes: 0, cyclingKm: null },
      ],
    }),
    identityCaffeine,
  );
  assert.equal(rows[0].capacity.walkingMinutes, 0, "explicit 0 must stay 0");
  assert.equal(rows[1].capacity.walkingMinutes, null, "no Health row at all must stay null, not 0");
});

test("work sessions group onto the correct operator day and sum tracked seconds correctly", () => {
  const rows = buildDailyLedger(
    ["2026-08-30"],
    emptyFacts({
      workSessions: [
        { date: "2026-08-30", videoId: 1, startedAt: new Date("2026-08-30T13:00:00Z"), endedAt: new Date("2026-08-30T14:00:00Z"), seconds: 3600 },
        { date: "2026-08-30", videoId: 2, startedAt: new Date("2026-08-30T15:00:00Z"), endedAt: new Date("2026-08-30T15:30:00Z"), seconds: 1800 },
      ],
    }),
    identityCaffeine,
  );
  assert.equal(rows[0].work.trackedSeconds, 5400);
  assert.equal(rows[0].work.sessionCount, 2);
  assert.equal(rows[0].work.videosTouched, 2);
  assert.equal(rows[0].work.longestSessionSeconds, 3600);
});

test("USD and BRL revenue are never merged into one economics figure", () => {
  const rows = buildDailyLedger(
    ["2026-08-30"],
    emptyFacts({
      transactions: [
        { date: "2026-08-30", type: "income", currency: "USD", amount: 100 },
        { date: "2026-08-30", type: "income", currency: "BRL", amount: 500 },
        { date: "2026-08-30", type: "expense", currency: "USD", amount: 20 },
      ],
    }),
    identityCaffeine,
  );
  const revenue = rows[0].economics.revenueByCurrency;
  assert.deepEqual(revenue, [
    { currency: "BRL", amount: 500 },
    { currency: "USD", amount: 100 },
  ]);
  assert.deepEqual(rows[0].economics.expenseByCurrency, [{ currency: "USD", amount: 20 }]);
});

test("a commitment due and still open counts as missed; one completed on time does not", () => {
  const rows = buildDailyLedger(
    ["2026-08-30"],
    emptyFacts({
      commitments: [
        { dueDate: "2026-08-30", status: "OPEN", completedAt: null, dueAt: new Date("2026-08-30T12:00:00Z") },
        {
          dueDate: "2026-08-30",
          status: "DONE",
          completedAt: new Date("2026-08-30T11:00:00Z"),
          dueAt: new Date("2026-08-30T12:00:00Z"),
        },
      ],
    }),
    identityCaffeine,
  );
  assert.equal(rows[0].output.commitmentsDue, 2);
  assert.equal(rows[0].output.commitmentsMissed, 1);
});

test("OUR_ERROR revisions are counted separately from total detailed revisions", () => {
  const rows = buildDailyLedger(
    ["2026-08-30"],
    emptyFacts({
      revisions: [
        { date: "2026-08-30", causedBy: "OUR_ERROR", minutesRework: 20 },
        { date: "2026-08-30", causedBy: "CLIENT_CHANGE", minutesRework: null },
      ],
    }),
    identityCaffeine,
  );
  assert.equal(rows[0].quality.detailedRevisions, 2);
  assert.equal(rows[0].quality.ourErrorRevisions, 1);
  assert.equal(rows[0].quality.reworkMinutes, 20, "only the row with rework evidence contributes");
});
