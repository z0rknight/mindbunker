import assert from "node:assert/strict";
import test from "node:test";

import {
  getProjectGroup,
  getProjectProgress,
  groupProjectsForOverview,
  isPositiveId,
  isProjectOverdue,
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
    });
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
