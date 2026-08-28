import assert from "node:assert/strict";
import test from "node:test";

import {
  getProjectGroup,
  getProjectProgress,
  groupProjectsForOverview,
  isPositiveId,
  isProjectOverdue,
  naturalCompare,
  resolveCurrentWorkVideo,
  sortProjectWorkspaceVideos,
  validateProjectInput,
} from "./core.ts";

test("project input keeps only useful bounded fields", () => {
  const result = validateProjectInput({
    name: "  Product launch  ",
    status: "active",
    deadline: "2026-09-10",
    notes: "  First delivery  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      name: "Product launch",
      status: "active",
      deadline: "2026-09-10",
      notes: "First delivery",
      coverUrl: null,
    });
  }
});

// Sprint 3 P1 (Project + Video visual covers): reuses productivity's
// validateCoverUrl (HTTPS-only) -- one cover-URL safety rule, not two.
test("project input accepts a valid HTTPS cover URL and rejects an unsafe one", () => {
  const valid = validateProjectInput({
    name: "Product launch",
    status: "active",
    coverUrl: "https://cdn.example.com/cover.jpg",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.coverUrl, "https://cdn.example.com/cover.jpg");
  }

  const unsafe = validateProjectInput({
    name: "Product launch",
    status: "active",
    coverUrl: "javascript:alert(1)",
  });
  assert.equal(unsafe.success, false);
});

test("project input treats an omitted cover URL as optional, not an error", () => {
  const result = validateProjectInput({ name: "Product launch", status: "active" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.coverUrl, null);
  }
});

test("project input rejects invalid status, date, and ids", () => {
  assert.equal(
    validateProjectInput({ name: "Project", status: "fake" }).success,
    false,
  );
  assert.equal(
    validateProjectInput({
      name: "Project",
      status: "active",
      deadline: "2026-02-31",
    }).success,
    false,
  );
  assert.equal(isPositiveId(1), true);
  assert.equal(isPositiveId(0), false);
  assert.equal(isPositiveId(1.2), false);
});

function project(overrides = {}) {
  return {
    id: 1,
    clientId: 1,
    clientName: "Fictitious Client",
    name: "Fictitious Project",
    status: "active",
    deadline: null,
    notes: null,
    updatedAt: new Date("2026-08-20T12:00:00Z"),
    totalVideos: 5,
    doneVideos: 1,
    inFlightVideos: 3,
    plannedVideos: 1,
    ...overrides,
  };
}

test("project statuses map to the three operational groups", () => {
  assert.equal(getProjectGroup("active"), "active");
  assert.equal(getProjectGroup("review"), "active");
  assert.equal(getProjectGroup("planned"), "planned");
  assert.equal(getProjectGroup("delivered"), "completed");
  assert.equal(getProjectGroup("archived"), "completed");
});

test("project progress is derived from DONE videos only", () => {
  assert.equal(getProjectProgress(project()), 20);
  assert.equal(
    getProjectProgress(project({ totalVideos: 0, doneVideos: 0 })),
    0,
  );
});

test("project overview groups and sorts active work before review", () => {
  const groups = groupProjectsForOverview([
    project({ id: 4, status: "archived" }),
    project({ id: 3, status: "planned", deadline: null }),
    project({ id: 2, status: "review", deadline: "2026-08-22" }),
    project({ id: 1, status: "active", deadline: "2026-08-24" }),
  ]);

  assert.deepEqual(groups.active.map(({ id }) => id), [1, 2]);
  assert.deepEqual(groups.planned.map(({ id }) => id), [3]);
  assert.deepEqual(groups.completed.map(({ id }) => id), [4]);
});

test("overdue is derived from deadline and excludes completed work", () => {
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-08-21" }), "2026-08-22"),
    true,
  );
  assert.equal(
    isProjectOverdue(
      project({ deadline: "2026-08-21", status: "delivered" }),
      "2026-08-22",
    ),
    false,
  );
  assert.equal(
    isProjectOverdue(project({ deadline: null }), "2026-08-22"),
    false,
  );
});

// Brief C ("Final Local Ingest / Live Readiness") §9: bulk-generated names
// like "Bonnie Content Waterfall_1" ... "_9" must not lexically sort as
// "_1", "_10", "_2" ... -- natural (numeric-aware) sort is required.
test("naturalCompare puts _2 before _10", () => {
  const names = [
    "Bonnie Content Waterfall_10",
    "Bonnie Content Waterfall_2",
    "Bonnie Content Waterfall_1",
    "Bonnie Content Waterfall_9",
  ];
  const sorted = [...names].sort(naturalCompare);
  assert.deepEqual(sorted, [
    "Bonnie Content Waterfall_1",
    "Bonnie Content Waterfall_2",
    "Bonnie Content Waterfall_9",
    "Bonnie Content Waterfall_10",
  ]);
});

test("sortProjectWorkspaceVideos groups by batch label, then date, then natural name order", () => {
  const videos = [
    { id: 3, title: "Bonnie Content Waterfall_9", date: "2026-08-24", batchLabel: "Batch 1" },
    { id: 1, title: "Bonnie Content Waterfall_10", date: "2026-08-24", batchLabel: "Batch 1" },
    { id: 2, title: "Bonnie Content Waterfall_2", date: "2026-08-24", batchLabel: "Batch 1" },
    { id: 4, title: "Standalone cut", date: "2026-08-20", batchLabel: null },
  ];
  const sorted = sortProjectWorkspaceVideos(videos);
  assert.deepEqual(sorted.map((v) => v.id), [4, 2, 3, 1]);
});

test("sortProjectWorkspaceVideos falls back to id for total determinism", () => {
  const videos = [
    { id: 9, title: "", date: "2026-01-01", batchLabel: null },
    { id: 2, title: "", date: "2026-01-01", batchLabel: null },
  ];
  const sorted = sortProjectWorkspaceVideos(videos);
  assert.deepEqual(sorted.map((v) => v.id), [2, 9]);
});


// NIGHT SHIFT REALITY PATCH §7 -- "current work" derivation, no new field.
test("resolveCurrentWorkVideo prefers the most recently updated in-flight video", () => {
  const videos = [
    { id: 1, status: "DONE", reviewUrl: null, updatedAt: new Date("2026-08-20T00:00:00Z"), createdAt: null },
    { id: 2, status: "IN_PROGRESS", reviewUrl: "https://review.example/2", updatedAt: new Date("2026-08-23T00:00:00Z"), createdAt: null },
    { id: 3, status: "CHANGES_REQUESTED", reviewUrl: "https://review.example/3", updatedAt: new Date("2026-08-24T00:00:00Z"), createdAt: null },
  ];
  const result = resolveCurrentWorkVideo(videos);
  assert.equal(result?.id, 3);
});

test("resolveCurrentWorkVideo falls back to the most recently updated reviewable video when nothing is in flight", () => {
  const videos = [
    { id: 1, status: "PLANNED", reviewUrl: null, updatedAt: new Date("2026-08-24T00:00:00Z"), createdAt: null },
    { id: 2, status: "READY_FOR_REVIEW", reviewUrl: "https://review.example/2", updatedAt: new Date("2026-08-22T00:00:00Z"), createdAt: null },
    { id: 3, status: "DONE", reviewUrl: "https://review.example/3", updatedAt: new Date("2026-08-23T00:00:00Z"), createdAt: null },
  ];
  const result = resolveCurrentWorkVideo(videos);
  assert.equal(result?.id, 3);
});

test("resolveCurrentWorkVideo returns null rather than fabricating current work", () => {
  const videos = [
    { id: 1, status: "PLANNED", reviewUrl: null, updatedAt: null, createdAt: null },
    { id: 2, status: "DONE", reviewUrl: null, updatedAt: null, createdAt: null },
  ];
  assert.equal(resolveCurrentWorkVideo(videos), null);
});

test("resolveCurrentWorkVideo returns null for an empty project", () => {
  assert.equal(resolveCurrentWorkVideo([]), null);
});
