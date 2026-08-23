import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_VIDEO_STATUS_LABELS,
  buildClientDashboard,
  buildClientPortalProjects,
  filterClientDashboardVideos,
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


// --- buildClientDashboard (Sprint 1.2.2, Phase 3 authorization coverage) --

const NOW = new Date("2026-08-23T12:00:00.000Z"); // a Sunday
const THIS_MONDAY = new Date("2026-08-17T00:00:00.000Z");
const LAST_WEEK = new Date("2026-08-10T09:00:00.000Z");

const dashboardProjects = [
  { id: 1, clientId: 2, name: "Launch Campaign", status: "active", deadline: null },
  { id: 9, clientId: 7, name: "Other client's project", status: "active", deadline: null },
];

function video(overrides) {
  return {
    id: 1,
    projectId: 1,
    clientId: 2,
    projectClientId: 2,
    title: "Untitled",
    date: "2026-08-20",
    status: "IN_PROGRESS",
    deliveryUrl: null,
    coverUrl: null,
    orientation: null,
    contentType: null,
    createdAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

test("dashboard never includes another client's projects, videos, or completion events", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, status: "IN_PROGRESS" }),
      video({
        id: 99,
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        status: "DONE",
        title: "Someone else's finished video",
      }),
    ],
    [
      { videoId: 1, createdAt: THIS_MONDAY },
      { videoId: 99, createdAt: THIS_MONDAY }, // belongs to the other client -- must not count
    ],
    NOW,
  );

  assert.equal(result.activeProjectsCount, 1);
  assert.equal(result.totalVideos, 1);
  assert.equal(result.totals.completed, 0);
  assert.equal(result.completedThisWeek, 0); // video 1 isn't DONE, video 99 isn't owned
  assert.equal(
    result.currentWork.some((entry) => entry.title.includes("else")),
    false,
  );
});

test("completedThisWeek only counts owned videos with a completion event this week", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, status: "DONE", title: "Finished this week" }),
      video({ id: 2, status: "DONE", title: "Finished last week" }),
    ],
    [
      { videoId: 1, createdAt: THIS_MONDAY },
      { videoId: 2, createdAt: LAST_WEEK },
    ],
    NOW,
  );

  assert.equal(result.completedThisWeek, 1);
  assert.equal(result.totals.completed, 2);
  assert.equal(result.totalVideos, 2);
});

test("current work and ready-for-review buckets are lifecycle-scoped, not a dump of every video", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, status: "PLANNED", title: "Not started" }),
      video({ id: 2, status: "IN_PROGRESS", title: "In progress" }),
      video({ id: 3, status: "CHANGES_REQUESTED", title: "Needs changes" }),
      video({ id: 4, status: "READY_FOR_REVIEW", title: "Awaiting review" }),
      video({ id: 5, status: "DONE", title: "Done" }),
    ],
    [],
    NOW,
  );

  assert.deepEqual(
    result.currentWork.map((entry) => entry.title).toSorted(),
    ["In progress", "Needs changes"],
  );
  assert.deepEqual(
    result.readyForReview.map((entry) => entry.title),
    ["Awaiting review"],
  );
  assert.equal(result.totals.inProduction, 2);
  assert.equal(result.totals.readyForReview, 1);
  assert.equal(result.totals.completed, 1);
});

test("recent deliveries are sorted newest-first and capped at 5", () => {
  const videos = Array.from({ length: 7 }, (_, index) =>
    video({ id: index + 1, status: "DONE", title: `Video ${index + 1}` }),
  );
  const events = videos.map((entry, index) => ({
    videoId: entry.id,
    createdAt: new Date(THIS_MONDAY.getTime() + index * 1_000),
  }));

  const result = buildClientDashboard(2, dashboardProjects, videos, events, NOW);

  assert.equal(result.recentDeliveries.length, 5);
  assert.deepEqual(
    result.recentDeliveries.map((entry) => entry.title),
    ["Video 7", "Video 6", "Video 5", "Video 4", "Video 3"],
  );
});

test("cover and delivery URLs are sanitized the same way as the token-only portal view", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({
        id: 1,
        deliveryUrl: "javascript:alert(1)",
        coverUrl: "javascript:alert(1)",
      }),
    ],
    [],
    NOW,
  );

  assert.equal(result.currentWork[0].deliveryUrl, null);
  assert.equal(result.currentWork[0].coverUrl, null);
});

test("content breakdown only counts completed videos, and unclassified is tracked separately from zero", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, status: "DONE", contentType: "short-form" }),
      video({ id: 2, status: "DONE", contentType: "short-form" }),
      video({ id: 3, status: "DONE", contentType: null }),
      video({ id: 4, status: "IN_PROGRESS", contentType: "long-form" }), // not completed -- excluded
    ],
    [],
    NOW,
  );

  assert.deepEqual(result.contentBreakdown, [
    { contentType: "short-form", label: "Short-form", completedCount: 2 },
  ]);
  assert.equal(result.unclassifiedCompletedCount, 1);
});

test("dashboard is safe on a client with zero projects and zero videos", () => {
  const result = buildClientDashboard(2, [], [], [], NOW);
  assert.equal(result.activeProjectsCount, 0);
  assert.equal(result.totalVideos, 0);
  assert.deepEqual(result.totals, { completed: 0, inProduction: 0, readyForReview: 0 });
  assert.equal(result.completedThisWeek, 0);
  assert.deepEqual(result.currentWork, []);
  assert.deepEqual(result.readyForReview, []);
  assert.deepEqual(result.recentDeliveries, []);
  assert.deepEqual(result.allVideos, []);
  assert.deepEqual(result.contentBreakdown, []);
  assert.equal(result.unclassifiedCompletedCount, 0);
});

test("dashboard content filter stays inside the already client-scoped projection", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, contentType: "long-form", title: "Owned long-form" }),
      video({ id: 2, contentType: "short-form", title: "Owned short-form" }),
      video({
        id: 99,
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        contentType: "long-form",
        title: "Other client secret",
      }),
    ],
    [],
    NOW,
  );

  assert.deepEqual(
    filterClientDashboardVideos(result.allVideos, "long-form").map((entry) => entry.title),
    ["Owned long-form"],
  );
  assert.equal(JSON.stringify(result.allVideos).includes("Other client secret"), false);
  assert.equal(filterClientDashboardVideos(result.allVideos, "short-form").length, 1);
  assert.equal(filterClientDashboardVideos(result.allVideos, "all").length, 2);
});
