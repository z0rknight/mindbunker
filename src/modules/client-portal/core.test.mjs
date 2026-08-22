import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_VIDEO_STATUS_LABELS,
  buildClientPortalProjects,
} from "./core.ts";

const updatedAt = new Date("2026-08-22T03:00:00.000Z");

test("client lifecycle labels are presentation-only and cover every state", () => {
  assert.deepEqual(CLIENT_VIDEO_STATUS_LABELS, {
    PLANNED: "Planned",
    IN_PROGRESS: "In production",
    READY_FOR_REVIEW: "Review",
    CHANGES_REQUESTED: "Updates in progress",
    DONE: "Delivered",
  });
});

test("portal projection cannot expand beyond the token-bound client", () => {
  const result = buildClientPortalProjects(
    2,
    [
      {
        id: 1,
        clientId: 2,
        name: "MINI SERIES",
        status: "active",
        deadline: "2026-08-24",
      },
      {
        id: 9,
        clientId: 7,
        name: "Other client secret project",
        status: "active",
        deadline: null,
      },
    ],
    [
      {
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video 1 - MINI SERIES",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: "https://video.example/taryn",
        createdAt: null,
        updatedAt,
      },
      {
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        title: "Other client private video",
        date: "2026-08-21",
        status: "DONE",
        deliveryUrl: "https://video.example/private",
        createdAt: null,
        updatedAt,
      },
      {
        projectId: 1,
        clientId: 7,
        projectClientId: 2,
        title: "Mismatched owner video",
        date: "2026-08-21",
        status: "DONE",
        deliveryUrl: "https://video.example/mismatch",
        createdAt: null,
        updatedAt,
      },
    ],
  );

  assert.deepEqual(result, [
    {
      name: "MINI SERIES",
      status: "Active",
      deadline: "2026-08-24",
      videos: [
        {
          title: "Video 1 - MINI SERIES",
          status: "In production",
          lastUpdated: "2026-08-22T03:00:00.000Z",
          deliveryUrl: "https://video.example/taryn",
        },
      ],
    },
  ]);
});

test("portal projection strips identifiers and internal-only fields", () => {
  const result = buildClientPortalProjects(
    2,
    [
      {
        id: 1,
        clientId: 2,
        name: "MINI SERIES",
        status: "active",
        deadline: null,
        notes: "must never leak",
      },
    ],
    [
      {
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Pilot",
        date: "2026-08-21",
        status: "DONE",
        deliveryUrl: "javascript:alert(1)",
        createdAt: updatedAt,
        updatedAt: null,
        notes: "private",
        revisionsCount: 4,
        revenue: 999,
      },
    ],
  );

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("must never leak"), false);
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("clientId"), false);
  assert.equal(serialized.includes("projectId"), false);
  assert.equal(serialized.includes("revisionsCount"), false);
  assert.equal(serialized.includes("revenue"), false);
  assert.equal(result[0].videos[0].deliveryUrl, null);
});
