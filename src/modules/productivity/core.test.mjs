import assert from "node:assert/strict";
import test from "node:test";

import {
  completedVideoLogs,
  getVideoNextAction,
  getVideoMetadataChanges,
  groupOperationalVideos,
  planVideoTransition,
  validateVideoAssignment,
  validateVideoCreateInput,
  validateDeliveryUrl,
  validateVideoInput,
} from "./core.ts";
import { isVideoDirectlyFinishable } from "./config.ts";

test("Productivity groups every video once around current operational work", () => {
  const videos = [
    { id: 1, status: "PLANNED", projectDeadline: null },
    { id: 2, status: "IN_PROGRESS", projectDeadline: "2026-08-30" },
    { id: 3, status: "READY_FOR_REVIEW", projectDeadline: null },
    { id: 4, status: "CHANGES_REQUESTED", projectDeadline: null },
    { id: 5, status: "DONE", projectDeadline: "2026-08-01" },
    { id: 6, status: "PLANNED", projectDeadline: "2026-08-20" },
  ].map((video) => ({
    ...video,
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: null,
  }));

  const groups = groupOperationalVideos(videos, {
    today: "2026-08-22",
    openSessionVideoId: 2,
  });

  assert.deepEqual(groups.current.map((video) => video.id), [2]);
  assert.deepEqual(groups.attention.map((video) => video.id), [6, 3, 4]);
  assert.deepEqual(groups.planned.map((video) => video.id), [1]);
  assert.deepEqual(groups.completed.map((video) => video.id), [5]);
  assert.equal(groups.current[0].isActiveSession, true);
  assert.equal(groups.attention[0].isOverdue, true);

  const groupedIds = Object.values(groups).flat().map((video) => video.id);
  assert.equal(groupedIds.length, videos.length);
  assert.deepEqual([...new Set(groupedIds)].sort(), [1, 2, 3, 4, 5, 6]);
});

test("active work is sorted first and lifecycle actions stay explicit", () => {
  const videos = [7, 8].map((id) => ({
    id,
    status: "IN_PROGRESS",
    projectDeadline: null,
    createdAt: `2026-08-${id + 10}T12:00:00.000Z`,
    updatedAt: null,
  }));
  const groups = groupOperationalVideos(videos, {
    today: "2026-08-22",
    openSessionVideoId: 7,
  });
  assert.deepEqual(groups.current.map((video) => video.id), [7, 8]);
  assert.equal(getVideoNextAction("PLANNED"), "Start production");
  assert.equal(getVideoNextAction("READY_FOR_REVIEW"), "Review and decide");
  assert.equal(
    getVideoNextAction("CHANGES_REQUESTED"),
    "Apply requested changes",
  );
});

test("video input preserves its project and client references", () => {
  const result = validateVideoInput({
    title: "  Launch cut  ",
    projectId: 4,
    clientId: 2,
    notes: "  Vertical version  ",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      title: "Launch cut",
      projectId: 4,
      clientId: 2,
      deliveryUrl: null,
      notes: "Vertical version",
    });
  }
});

test("delivery URL accepts empty or HTTPS and rejects unsafe protocols", () => {
  assert.deepEqual(validateDeliveryUrl(""), { success: true, value: null });
  assert.deepEqual(validateDeliveryUrl(null), { success: true, value: null });
  assert.deepEqual(validateDeliveryUrl("https://example.com/watch/123"), {
    success: true,
    value: "https://example.com/watch/123",
  });

  for (const unsafe of [
    "http://example.com/watch",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/video.mov",
    "not a url",
    "https://user:password@example.com/watch",
  ]) {
    assert.equal(validateDeliveryUrl(unsafe).success, false, unsafe);
  }
});

test("video input rejects nameless videos and invalid references", () => {
  assert.equal(validateVideoInput({ title: "" }).success, false);
  assert.equal(
    validateVideoInput({ title: "Cut", projectId: -1 }).success,
    false,
  );
});

test("new video status is explicit and cannot silently become completed", () => {
  assert.equal(
    validateVideoCreateInput({
      title: "Planned cut",
      projectId: 4,
      status: "PLANNED",
    }).success,
    true,
  );
  assert.equal(
    validateVideoCreateInput({
      title: "No project",
      status: "PLANNED",
    }).success,
    false,
  );
  assert.equal(
    validateVideoCreateInput({
      title: "Finished cut",
      projectId: 4,
      status: "DONE",
    }).success,
    false,
  );
});

test("Finished Video can only complete an existing directly finishable identity", () => {
  assert.equal(isVideoDirectlyFinishable("PLANNED"), false);
  assert.equal(isVideoDirectlyFinishable("IN_PROGRESS"), true);
  assert.equal(isVideoDirectlyFinishable("READY_FOR_REVIEW"), true);
  assert.equal(isVideoDirectlyFinishable("CHANGES_REQUESTED"), false);
  assert.equal(isVideoDirectlyFinishable("DONE"), false);
});

test("only DONE counts as completed output across the five lifecycle states", () => {
  const date = "2026-08-21";
  const videos = [
    { id: 1, date, status: "PLANNED" },
    { id: 2, date, status: "IN_PROGRESS" },
    { id: 3, date, status: "READY_FOR_REVIEW" },
    { id: 4, date, status: "CHANGES_REQUESTED" },
    { id: 5, date, status: "DONE" },
  ];

  assert.deepEqual(
    completedVideoLogs(videos).map((video) => video.id),
    [5],
  );
});

test("client and project assignment must agree", () => {
  assert.deepEqual(
    validateVideoAssignment({
      requestedClientId: 2,
      projectId: 8,
      project: { clientId: 2, status: "active" },
    }),
    { success: true, clientId: 2 },
  );
  assert.equal(
    validateVideoAssignment({
      requestedClientId: 3,
      projectId: 8,
      project: { clientId: 2, status: "active" },
    }).success,
    false,
  );
  assert.equal(
    validateVideoAssignment({
      requestedClientId: null,
      projectId: 8,
      project: { clientId: 2, status: "archived" },
    }).success,
    false,
  );
});

test("metadata diff emits one compact change set and ignores replay", () => {
  const current = {
    title: "Launch cut",
    clientId: 2,
    projectId: 8,
    deliveryUrl: null,
    notes: "Vertical",
  };
  assert.deepEqual(getVideoMetadataChanges(current, current), []);
  assert.deepEqual(
    getVideoMetadataChanges(current, {
      ...current,
      title: "Launch cut v2",
      deliveryUrl: "https://example.com/launch-cut-v2",
      notes: "Vertical with captions",
    }),
    ["title", "deliveryUrl", "notes"],
  );
});

test("lifecycle transitions include reopen and repeated submission is a no-op", () => {
  assert.equal(
    planVideoTransition({
      currentStatus: "PLANNED",
      expectedStatus: "PLANNED",
      targetStatus: "IN_PROGRESS",
    }).success,
    true,
  );

  const reopened = planVideoTransition({
    currentStatus: "DONE",
    expectedStatus: "DONE",
    targetStatus: "CHANGES_REQUESTED",
  });
  assert.equal(reopened.success, true);
  if (reopened.success && reopened.changed) {
    assert.equal(reopened.eventType, "video.reopened");
    assert.equal(reopened.delivered, false);
  }

  assert.deepEqual(
    planVideoTransition({
      currentStatus: "IN_PROGRESS",
      expectedStatus: "PLANNED",
      targetStatus: "IN_PROGRESS",
    }),
    { success: true, changed: false, status: "IN_PROGRESS" },
  );
  assert.equal(
    planVideoTransition({
      currentStatus: "PLANNED",
      expectedStatus: "PLANNED",
      targetStatus: "DONE",
    }).success,
    false,
  );
});

test("the required lifecycle transition vocabulary is explicit", () => {
  const cases = [
    ["PLANNED", "IN_PROGRESS", "video.started"],
    ["IN_PROGRESS", "READY_FOR_REVIEW", "video.ready_for_review"],
    ["READY_FOR_REVIEW", "CHANGES_REQUESTED", "video.changes_requested"],
    ["CHANGES_REQUESTED", "IN_PROGRESS", "video.started"],
    ["CHANGES_REQUESTED", "READY_FOR_REVIEW", "video.ready_for_review"],
    ["READY_FOR_REVIEW", "DONE", "video.finished"],
    ["IN_PROGRESS", "DONE", "video.finished"],
    ["DONE", "CHANGES_REQUESTED", "video.reopened"],
  ];

  for (const [currentStatus, targetStatus, eventType] of cases) {
    const result = planVideoTransition({
      currentStatus,
      expectedStatus: currentStatus,
      targetStatus,
    });
    assert.equal(result.success, true);
    if (result.success && result.changed) {
      assert.equal(result.eventType, eventType);
      assert.equal(result.delivered, targetStatus === "DONE");
    }
  }
});
