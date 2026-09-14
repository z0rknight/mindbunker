import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedSlice,
  filterVideosForClient,
  formatCommercialRelationship,
  selectActiveContractForClient,
  selectActiveJobs,
} from "./spatial-composition.ts";

function project(overrides = {}) {
  return { id: 1, status: "active", ...overrides };
}

function contract(overrides = {}) {
  return { id: 1, clientId: 1, status: "ACTIVE", platform: "Direct", createdAt: new Date("2026-01-01"), ...overrides };
}

test("selectActiveJobs keeps only active/review projects, in order", () => {
  const projects = [
    project({ id: 1, status: "planned" }),
    project({ id: 2, status: "active" }),
    project({ id: 3, status: "review" }),
    project({ id: 4, status: "delivered" }),
    project({ id: 5, status: "archived" }),
  ];
  const { shown, hiddenCount } = selectActiveJobs(projects, 4);
  assert.deepEqual(shown.map((p) => p.id), [2, 3]);
  assert.equal(hiddenCount, 0);
});

test("selectActiveJobs bounds the shown list and reports the remainder", () => {
  const projects = [1, 2, 3, 4, 5].map((id) => project({ id, status: "active" }));
  const { shown, hiddenCount } = selectActiveJobs(projects, 4);
  assert.equal(shown.length, 4);
  assert.equal(hiddenCount, 1);
});

test("selectActiveJobs returns an empty result for a client with no active work", () => {
  const projects = [project({ id: 1, status: "planned" }), project({ id: 2, status: "archived" })];
  const { shown, hiddenCount } = selectActiveJobs(projects, 4);
  assert.deepEqual(shown, []);
  assert.equal(hiddenCount, 0);
});

test("selectActiveJobs: review and in-progress work is selected, planned/delivered/archived is not", () => {
  const projects = [
    project({ id: 1, status: "review" }),
    project({ id: 2, status: "active" }),
    project({ id: 3, status: "planned" }),
    project({ id: 4, status: "planned" }),
    project({ id: 5, status: "delivered" }),
  ];
  const { shown } = selectActiveJobs(projects, 4);
  assert.deepEqual(new Set(shown.map((p) => p.id)), new Set([1, 2]));
});

test("boundedSlice caps a list and reports how many were hidden", () => {
  assert.deepEqual(boundedSlice([1, 2, 3], 5), { shown: [1, 2, 3], hiddenCount: 0 });
  assert.deepEqual(boundedSlice([1, 2, 3, 4, 5], 2), { shown: [1, 2], hiddenCount: 3 });
});

test("boundedSlice: Taryn's reconciled 31-video project stays bounded to the display cap", () => {
  // Wave 3/5 reconciled truth: 9 DONE + 6 IN_PROGRESS + 1 READY_FOR_REVIEW +
  // 15 PLANNED = 31. The dense PLANNED tail must never flood the primary
  // region -- boundedSlice doesn't need to know about status at all, it
  // just has to cap the total and report the remainder accurately.
  const videos = Array.from({ length: 31 }, (_, i) => ({ id: i + 1 }));
  const { shown, hiddenCount } = boundedSlice(videos, 5);
  assert.equal(shown.length, 5);
  assert.equal(hiddenCount, 26);
});

test("filterVideosForClient never leaks another client's rows", () => {
  const videos = [
    { id: 1, clientId: 2 },
    { id: 2, clientId: 5 },
    { id: 3, clientId: 2 },
  ];
  const result = filterVideosForClient(videos, 2);
  assert.deepEqual(result.map((v) => v.id), [1, 3]);
  assert.ok(result.every((v) => v.clientId === 2));
});

test("filterVideosForClient returns nothing for a client with no unassigned deliverables (sparse/lead-safe)", () => {
  const videos = [{ id: 1, clientId: 2 }];
  assert.deepEqual(filterVideosForClient(videos, 999), []);
  assert.deepEqual(filterVideosForClient([], 2), []);
});

test("selectActiveContractForClient only matches this client's ACTIVE contract", () => {
  const contracts = [
    contract({ id: 1, clientId: 1, status: "ACTIVE", platform: "Upwork" }),
    contract({ id: 2, clientId: 2, status: "PAUSED", platform: "Direct" }),
    contract({ id: 3, clientId: 2, status: "ACTIVE", platform: "Direct" }),
  ];
  assert.equal(selectActiveContractForClient(contracts, 2)?.platform, "Direct");
  assert.equal(selectActiveContractForClient(contracts, 99), null);
});

test("selectActiveContractForClient returns null when the only match is not ACTIVE", () => {
  const contracts = [contract({ clientId: 2, status: "ENDED" })];
  assert.equal(selectActiveContractForClient(contracts, 2), null);
});

test("Dave: current Direct/Hourly contract wins over a superseded historical Fixed contract, regardless of array order", () => {
  // Production truth (Wave 5 pilot QA): Dave's current relationship is
  // Direct / HOURLY / $25. His first job (a landing page) was a one-off
  // FIXED $100 -- represented here as an ENDED contract, the way an
  // operator would actually record a superseded relationship. The
  // superseded row must never be picked over the current ACTIVE one, and
  // this must not depend on which one the caller happens to list first.
  const historicalFixed = contract({
    id: 1,
    clientId: 4,
    status: "ENDED",
    platform: "Direct",
    billingType: "FIXED",
    hourlyRate: null,
    createdAt: new Date("2026-06-01"),
  });
  const currentHourly = contract({
    id: 2,
    clientId: 4,
    status: "ACTIVE",
    platform: "Direct",
    billingType: "HOURLY",
    hourlyRate: 25,
    createdAt: new Date("2026-08-01"),
  });

  const forward = selectActiveContractForClient([historicalFixed, currentHourly], 4);
  const reversed = selectActiveContractForClient([currentHourly, historicalFixed], 4);
  assert.equal(forward?.id, 2);
  assert.equal(reversed?.id, 2);
  assert.equal(forward?.billingType, "HOURLY");
});

test("Taryn: current Upwork/Hourly contract is selected", () => {
  const contracts = [contract({ id: 1, clientId: 2, status: "ACTIVE", platform: "Upwork", billingType: "HOURLY", hourlyRate: 25 })];
  const result = selectActiveContractForClient(contracts, 2);
  assert.equal(result?.platform, "Upwork");
  assert.equal(result?.billingType, "HOURLY");
});

test("selectActiveContractForClient: when two ACTIVE contracts exist for one client, the most recently created one wins deterministically", () => {
  const older = contract({ id: 1, clientId: 1, status: "ACTIVE", platform: "Direct", createdAt: new Date("2026-01-01") });
  const newer = contract({ id: 2, clientId: 1, status: "ACTIVE", platform: "Upwork", createdAt: new Date("2026-06-01") });
  assert.equal(selectActiveContractForClient([older, newer], 1)?.id, 2);
  assert.equal(selectActiveContractForClient([newer, older], 1)?.id, 2);
});

test("selectActiveContractForClient: equal createdAt breaks the tie by highest id, not array position", () => {
  const sameTime = new Date("2026-01-01");
  const a = contract({ id: 5, clientId: 1, status: "ACTIVE", createdAt: sameTime });
  const b = contract({ id: 9, clientId: 1, status: "ACTIVE", createdAt: sameTime });
  assert.equal(selectActiveContractForClient([a, b], 1)?.id, 9);
  assert.equal(selectActiveContractForClient([b, a], 1)?.id, 9);
});

test("formatCommercialRelationship reports no-contract state without fabricating one", () => {
  assert.equal(formatCommercialRelationship(null, (amount) => `$${amount}`), "No contract on file");
});

test("formatCommercialRelationship shows the hourly rate when present", () => {
  const relationship = { platform: "Upwork", billingType: "HOURLY", hourlyRate: 25 };
  assert.equal(formatCommercialRelationship(relationship, (amount) => `$${amount}`), "Upwork · Hourly · $25/hr");
});

test("formatCommercialRelationship never invents a FIXED amount the schema doesn't store", () => {
  const relationship = { platform: "Direct", billingType: "FIXED", hourlyRate: null };
  const value = formatCommercialRelationship(relationship, (amount) => `$${amount}`);
  assert.equal(value, "Direct · Fixed");
  assert.ok(!value.includes("$"));
});

test("sparse/lead composition: every helper degrades to an empty, non-crashing result", () => {
  const { shown: jobs, hiddenCount: hiddenJobs } = selectActiveJobs([], 4);
  assert.deepEqual(jobs, []);
  assert.equal(hiddenJobs, 0);
  assert.deepEqual(filterVideosForClient([], 42), []);
  assert.equal(selectActiveContractForClient([], 42), null);
  assert.equal(formatCommercialRelationship(null, (amount) => `$${amount}`), "No contract on file");
});
