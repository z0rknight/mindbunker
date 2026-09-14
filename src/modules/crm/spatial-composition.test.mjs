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

test("boundedSlice caps a list and reports how many were hidden", () => {
  assert.deepEqual(boundedSlice([1, 2, 3], 5), { shown: [1, 2, 3], hiddenCount: 0 });
  assert.deepEqual(boundedSlice([1, 2, 3, 4, 5], 2), { shown: [1, 2], hiddenCount: 3 });
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

test("selectActiveContractForClient only matches this client's ACTIVE contract", () => {
  const contracts = [
    { clientId: 1, status: "ACTIVE", platform: "Upwork" },
    { clientId: 2, status: "PAUSED", platform: "Direct" },
    { clientId: 2, status: "ACTIVE", platform: "Direct" },
  ];
  assert.deepEqual(selectActiveContractForClient(contracts, 2), { clientId: 2, status: "ACTIVE", platform: "Direct" });
  assert.equal(selectActiveContractForClient(contracts, 99), null);
});

test("selectActiveContractForClient returns null when the only match is not ACTIVE", () => {
  const contracts = [{ clientId: 2, status: "ENDED", platform: "Direct" }];
  assert.equal(selectActiveContractForClient(contracts, 2), null);
});

test("formatCommercialRelationship reports no-contract state without fabricating one", () => {
  assert.equal(formatCommercialRelationship(null, (amount) => `$${amount}`), "No contract on file");
});

test("formatCommercialRelationship shows the hourly rate when present", () => {
  const contract = { platform: "Upwork", billingType: "HOURLY", hourlyRate: 25 };
  assert.equal(formatCommercialRelationship(contract, (amount) => `$${amount}`), "Upwork · Hourly · $25/hr");
});

test("formatCommercialRelationship never invents a FIXED amount the schema doesn't store", () => {
  const contract = { platform: "Direct", billingType: "FIXED", hourlyRate: null };
  const value = formatCommercialRelationship(contract, (amount) => `$${amount}`);
  assert.equal(value, "Direct · Fixed");
  assert.ok(!value.includes("$"));
});
