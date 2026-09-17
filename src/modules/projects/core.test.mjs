import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProjectsBySearch,
  getProjectException,
  getProjectGroup,
  getProjectNextAction,
  getProjectProgress,
  groupProjectsByClient,
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
    clientDefaultCoverUrl: null,
    clientAvatarUrl: null,
    name: "Fictitious Project",
    status: "active",
    deadline: null,
    notes: null,
    updatedAt: new Date("2026-08-20T12:00:00Z"),
    totalVideos: 5,
    doneVideos: 1,
    inFlightVideos: 3,
    plannedVideos: 1,
    openBlockerCount: 0,
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

// Sep 17 Morning Production QA Patch: reproduced directly from the
// operator's real "September Content Waterfall" project -- 6/6 videos
// already done, still reading "3D OVERDUE" because project.status (a
// separate, operator-set field) had not yet been manually moved past
// "active". Acceptance cases from the mission brief §6.
test("CASE A: an active project with unfinished, overdue work is genuinely overdue", () => {
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-09-01", status: "active", totalVideos: 6, doneVideos: 4 }), "2026-09-08"),
    true,
  );
});

test("CASE B: every real deliverable already DONE, deadline passed, status still active -- NOT overdue (this is the reported bug)", () => {
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-09-14", status: "active", totalVideos: 6, doneVideos: 6 }), "2026-09-17"),
    false,
  );
  assert.equal(
    getProjectException(project({ deadline: "2026-09-14", status: "active", totalVideos: 6, doneVideos: 6, openBlockerCount: 0 }), "2026-09-17"),
    null,
    "a fully-delivered batch must show no exception badge at all, not a misleading OVERDUE one",
  );
});

test("CASE C: a project explicitly marked completed (delivered/archived) is never overdue regardless of video counts", () => {
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-09-01", status: "delivered", totalVideos: 6, doneVideos: 6 }), "2026-09-08"),
    false,
  );
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-09-01", status: "archived", totalVideos: 3, doneVideos: 1 }), "2026-09-08"),
    false,
    "archived work stays closed history even if not every video reached DONE",
  );
});

test("CASE D: a project with zero videos ever registered stays overdue on a passed deadline -- unknown never becomes healthy by assumption", () => {
  assert.equal(
    isProjectOverdue(project({ deadline: "2026-09-01", status: "active", totalVideos: 0, doneVideos: 0 }), "2026-09-08"),
    true,
    "nothing was ever produced against a passed deadline -- that is a real miss, not a healthy project",
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

// ─── Tuesday Patch Priority 2: Projects structural redesign ────────────────

test("getProjectNextAction: videos remaining to plan/shoot always wins first", () => {
  assert.equal(
    getProjectNextAction(project({ totalVideos: 10, doneVideos: 0, plannedVideos: 10 })),
    "Produce 10 planned videos",
  );
});

test("getProjectNextAction: in-flight videos surface when nothing is left planned", () => {
  assert.equal(
    getProjectNextAction(project({ totalVideos: 2, doneVideos: 0, inFlightVideos: 2, plannedVideos: 0 })),
    "Finish 2 videos in flight",
  );
});

test("getProjectNextAction: all videos done but status still active answers 'why' -- Move to review", () => {
  // This is the exact inconsistency the brief calls out: a project that
  // reads 2/2 complete yet remains ACTIVE. The UI must say why.
  assert.equal(
    getProjectNextAction(project({ status: "active", totalVideos: 2, doneVideos: 2, inFlightVideos: 0, plannedVideos: 0 })),
    "Move to review",
  );
});

test("getProjectNextAction: review status names the real next step, not a guess", () => {
  assert.equal(
    getProjectNextAction(project({ status: "review", totalVideos: 2, doneVideos: 2, inFlightVideos: 0, plannedVideos: 0 })),
    "Client review",
  );
});

test("getProjectNextAction: delivered/archived projects have no next action -- never fabricated", () => {
  assert.equal(getProjectNextAction(project({ status: "delivered", totalVideos: 2, doneVideos: 2, inFlightVideos: 0, plannedVideos: 0 })), null);
  assert.equal(getProjectNextAction(project({ status: "archived", totalVideos: 2, doneVideos: 2, inFlightVideos: 0, plannedVideos: 0 })), null);
});

test("getProjectNextAction: zero videos means plan the first one", () => {
  assert.equal(getProjectNextAction(project({ totalVideos: 0 })), "Plan the first video");
});

test("getProjectException: overdue outranks blocked outranks planned; normal active/review gets no badge", () => {
  const today = "2026-09-08";
  assert.equal(getProjectException(project({ deadline: "2026-09-01", status: "active" }), today), "OVERDUE");
  assert.equal(getProjectException(project({ openBlockerCount: 1 }), today), "BLOCKED");
  assert.equal(getProjectException(project({ status: "planned" }), today), "PLANNED");
  assert.equal(getProjectException(project({ status: "active" }), today), null);
  assert.equal(getProjectException(project({ status: "review" }), today), null);
  assert.equal(
    getProjectException(project({ deadline: "2026-09-01", openBlockerCount: 1, status: "active" }), today),
    "OVERDUE",
  );
});

test("groupProjectsByClient: client groups with a real exception sort before groups without one", () => {
  const groups = groupProjectsByClient(
    [
      project({ id: 1, clientId: 1, clientName: "Alice", status: "active" }),
      project({ id: 2, clientId: 2, clientName: "Zeke", deadline: "2026-01-01", status: "active" }),
    ],
    "2026-09-08",
  );
  assert.deepEqual(groups.map((g) => g.clientName), ["Zeke", "Alice"]);
  assert.equal(groups[0].hasException, true);
  assert.equal(groups[1].hasException, false);
});

test("groupProjectsByClient: within a client, overdue projects sort to the top in attention mode", () => {
  const groups = groupProjectsByClient(
    [
      project({ id: 1, clientId: 1, name: "On time", status: "active" }),
      project({ id: 2, clientId: 1, name: "Late", deadline: "2026-01-01", status: "active" }),
    ],
    "2026-09-08",
    "attention",
  );
  assert.deepEqual(groups[0].projects.map((p) => p.name), ["Late", "On time"]);
});

test("groupProjectsByClient: no project is duplicated or dropped across groups", () => {
  const input = [
    project({ id: 1, clientId: 1 }),
    project({ id: 2, clientId: 1 }),
    project({ id: 3, clientId: 2 }),
  ];
  const groups = groupProjectsByClient(input, "2026-09-08");
  const total = groups.reduce((sum, g) => sum + g.projects.length, 0);
  assert.equal(total, input.length);
});

test("filterProjectsBySearch matches project name or client name, case-insensitively", () => {
  const input = [
    project({ id: 1, name: "Meta Ads", clientName: "Dave" }),
    project({ id: 2, name: "Mini Series", clientName: "Taryn" }),
  ];
  assert.deepEqual(filterProjectsBySearch(input, "meta").map((p) => p.id), [1]);
  assert.deepEqual(filterProjectsBySearch(input, "TARYN").map((p) => p.id), [2]);
  assert.deepEqual(filterProjectsBySearch(input, "").map((p) => p.id), [1, 2]);
  assert.deepEqual(filterProjectsBySearch(input, "nonexistent"), []);
});
