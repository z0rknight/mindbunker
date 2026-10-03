import assert from "node:assert/strict";
import test from "node:test";
import { selectExecutionQueue } from "../productivity/queue.ts";
import {
  explainExecutionRecommendation,
  selectExecutionRecommendation,
} from "./core.ts";

function video(overrides = {}) {
  return {
    id: 1,
    title: "Video",
    date: "2026-10-03",
    status: "PLANNED",
    videoKind: "CLIENT_WORK",
    clientId: 1,
    clientName: "Client",
    projectId: 1,
    projectName: "Project",
    projectDeadline: null,
    coverUrl: null,
    projectCoverUrl: null,
    clientDefaultCoverUrl: null,
    clientAvatarUrl: null,
    orientation: null,
    isOperationalContainer: false,
    isPriority: false,
    cancelledAt: null,
    queuePosition: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: null,
    ...overrides,
  };
}

function recommend(videos, context = {}) {
  return selectExecutionRecommendation(selectExecutionQueue(videos, {
    blockedVideoIds: new Set(),
    ...context,
  }));
}

test("explicit project priority wins without an opaque score", () => {
  const selected = recommend([
    video({ id: 1, status: "CHANGES_REQUESTED", queuePosition: 1000 }),
    video({ id: 2, isPriority: true, queuePosition: 9000 }),
  ]);
  assert.equal(selected.id, 2);
  assert.equal(explainExecutionRecommendation(selected)[0].kind, "MANUAL_PRIORITY");
});

test("requested changes win over resumable and planned work", () => {
  const selected = recommend([
    video({ id: 1, status: "PLANNED", queuePosition: 1000 }),
    video({ id: 2, status: "IN_PROGRESS", queuePosition: 2000 }),
    video({ id: 3, status: "CHANGES_REQUESTED", queuePosition: 3000 }),
  ]);
  assert.equal(selected.id, 3);
});

test("an earlier open commitment breaks a same-stage tie", () => {
  const selected = recommend(
    [video({ id: 1 }), video({ id: 2 })],
    { soonestCommitmentDueAtByVideoId: new Map([
      [1, new Date("2026-10-10T00:00:00Z")],
      [2, new Date("2026-10-05T00:00:00Z")],
    ]) },
  );
  assert.equal(selected.id, 2);
  assert.ok(explainExecutionRecommendation(selected).some((signal) => signal.kind === "COMMITMENT_DUE"));
});

test("blocked and client-review items remain visible but are never recommended", () => {
  const videos = [
    video({ id: 1, isPriority: true }),
    video({ id: 2, status: "READY_FOR_REVIEW" }),
    video({ id: 3 }),
  ];
  const selected = recommend(videos, { blockedVideoIds: new Set([1]) });
  assert.equal(selected.id, 3);
});

test("cancelled work is absent from the canonical execution queue", () => {
  const selected = recommend([
    video({ id: 1, isPriority: true, cancelledAt: new Date("2026-10-03T00:00:00Z") }),
    video({ id: 2 }),
  ]);
  assert.equal(selected.id, 2);
});

test("queue position and id provide a stable final fallback", () => {
  const selected = recommend([
    video({ id: 9, queuePosition: 2000 }),
    video({ id: 4, queuePosition: 1000 }),
  ]);
  assert.equal(selected.id, 4);
});
