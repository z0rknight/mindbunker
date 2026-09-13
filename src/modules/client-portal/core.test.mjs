import assert from "node:assert/strict";
import test from "node:test";

import {
  CLIENT_VIDEO_STATUS_LABELS,
  buildClientDashboard,
  buildClientPortalProjects,
  buildClientVideoDetail,
  clientVideoStatusLabel,
  filterClientDashboardVideos,
  toCard,
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

// Client Portal Reality round §K (historical friction sweep, item 2):
// "Delivered" must be truthful, not just a status-code translation.
test("clientVideoStatusLabel only shows Delivered when a real deliveryUrl exists", () => {
  assert.equal(clientVideoStatusLabel("DONE", true), "Delivered");
  assert.equal(clientVideoStatusLabel("DONE", false), "Completed");
});

test("clientVideoStatusLabel leaves every non-DONE status unchanged regardless of deliveryUrl", () => {
  for (const status of ["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED"]) {
    assert.equal(clientVideoStatusLabel(status, true), CLIENT_VIDEO_STATUS_LABELS[status]);
    assert.equal(clientVideoStatusLabel(status, false), CLIENT_VIDEO_STATUS_LABELS[status]);
  }
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
        id: 101,
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video 1 - MINI SERIES",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: "https://video.example/taryn",
        coverUrl: null,
        projectCoverUrl: null,
        createdAt: null,
        updatedAt,
      },
      {
        id: 102,
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        title: "Other client private video",
        date: "2026-08-21",
        status: "DONE",
        deliveryUrl: "https://video.example/private",
        coverUrl: null,
        projectCoverUrl: null,
        createdAt: null,
        updatedAt,
      },
      {
        id: 103,
        projectId: 1,
        clientId: 7,
        projectClientId: 2,
        title: "Mismatched owner video",
        date: "2026-08-21",
        status: "DONE",
        deliveryUrl: "https://video.example/mismatch",
        coverUrl: null,
        projectCoverUrl: null,
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
          id: 101,
          title: "Video 1 - MINI SERIES",
          status: "In production",
          lastUpdated: "2026-08-22T03:00:00.000Z",
          deliveryUrl: "https://video.example/taryn",
          reviewUrl: null,
          publishedUrl: null,
          coverUrl: null,
          batchLabel: null,
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

// Client Portal Reality round: the token-based Vault view never carried
// covers or a stable `id` at all -- same tier-2 fallback chain
// (Video -> Project) as the authenticated dashboard's toCard, closed here.
test("portal projection resolves the same Video -> Project cover fallback as the dashboard, and carries a stable id", () => {
  const result = buildClientPortalProjects(
    2,
    [{ id: 1, clientId: 2, name: "MINI SERIES", status: "active", deadline: null }],
    [
      {
        id: 55,
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video with own cover",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: null,
        coverUrl: "https://cdn.example/video-cover.jpg",
        projectCoverUrl: "https://cdn.example/project-cover.jpg",
        createdAt: null,
        updatedAt,
      },
      {
        id: 56,
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video falls back to project cover",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: null,
        coverUrl: null,
        projectCoverUrl: "https://cdn.example/project-cover.jpg",
        createdAt: null,
        updatedAt,
      },
      {
        id: 57,
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video with no cover anywhere",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: null,
        coverUrl: null,
        projectCoverUrl: null,
        createdAt: null,
        updatedAt,
      },
    ],
  );

  const videos = result[0].videos;
  assert.deepEqual(videos.map((v) => v.id), [55, 56, 57]);
  assert.equal(videos[0].coverUrl, "https://cdn.example/video-cover.jpg");
  assert.equal(videos[1].coverUrl, "https://cdn.example/project-cover.jpg");
  assert.equal(videos[2].coverUrl, null);
});

test("portal projection rejects an unsafe cover URL the same way it rejects an unsafe delivery URL", () => {
  const result = buildClientPortalProjects(
    2,
    [{ id: 1, clientId: 2, name: "MINI SERIES", status: "active", deadline: null }],
    [
      {
        id: 58,
        projectId: 1,
        clientId: 2,
        projectClientId: 2,
        title: "Video with unsafe cover",
        date: "2026-08-21",
        status: "IN_PROGRESS",
        deliveryUrl: null,
        coverUrl: "javascript:alert(1)",
        projectCoverUrl: null,
        createdAt: null,
        updatedAt,
      },
    ],
  );
  assert.equal(result[0].videos[0].coverUrl, null);
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
    projectCoverUrl: null,
    clientDefaultCoverUrl: null,
    orientation: null,
    contentType: null,
    isPriority: false,
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

// Sprint 3 P1 (Client Gateway Intelligence): videosThisWeek/videosThisMonth
// count by production date (video.date), regardless of status -- distinct
// from completedThisWeek above, which is completion-event-driven and only
// ever counts finished videos.
test("videosThisWeek counts owned videos by production date within the current week, any status", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, date: "2026-08-18", status: "IN_PROGRESS" }), // this week (Mon 08-17..)
      video({ id: 2, date: "2026-08-10", status: "DONE" }), // last week
      video({
        id: 99,
        date: "2026-08-19",
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        status: "IN_PROGRESS",
      }), // another client -- must not count
    ],
    [],
    NOW,
  );

  assert.equal(result.videosThisWeek, 1);
});

test("videosThisMonth counts owned videos by production date within the current month", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({ id: 1, date: "2026-08-01", status: "PLANNED" }), // this month
      video({ id: 2, date: "2026-07-31", status: "DONE" }), // last month
    ],
    [],
    NOW,
  );

  assert.equal(result.videosThisMonth, 1);
});

test("videosThisWeek and videosThisMonth are 0 when there are no videos", () => {
  const result = buildClientDashboard(2, [], [], [], NOW);
  assert.equal(result.videosThisWeek, 0);
  assert.equal(result.videosThisMonth, 0);
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

// Sprint 3 P1 (Project + Video visual covers): cover fallback chain,
// Video -> Project (see resolveCoverUrl in modules/media/core.ts).
test("a video with no cover falls back to its project's cover", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [video({ id: 1, coverUrl: null, projectCoverUrl: "https://cdn.example.com/project-cover.jpg" })],
    [],
    NOW,
  );
  assert.equal(result.currentWork[0].coverUrl, "https://cdn.example.com/project-cover.jpg");
});

test("a video's own cover wins over its project's cover", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({
        id: 1,
        coverUrl: "https://cdn.example.com/video-cover.jpg",
        projectCoverUrl: "https://cdn.example.com/project-cover.jpg",
      }),
    ],
    [],
    NOW,
  );
  assert.equal(result.currentWork[0].coverUrl, "https://cdn.example.com/video-cover.jpg");
});

test("client default cover is used only after video and project covers", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [
      video({
        id: 1,
        coverUrl: null,
        projectCoverUrl: null,
        clientDefaultCoverUrl: "https://cdn.example.com/client-default.jpg",
      }),
    ],
    [],
    NOW,
  );
  assert.equal(result.currentWork[0].coverUrl, "https://cdn.example.com/client-default.jpg");
});

test("no cover anywhere in the chain stays null, not a fabricated URL", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [video({ id: 1, coverUrl: null, projectCoverUrl: null })],
    [],
    NOW,
  );
  assert.equal(result.currentWork[0].coverUrl, null);
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

// Quick Morning Reality Patch (26 Aug 2026) §4: honest single-video
// priority state -- a video alone in its project has projectVideoCount 1
// (nothing to prioritize against), a video sharing a project with others
// gets the real sibling count, and a video with no project gets null.
test("projectVideoCount reflects the real sibling count within the client's own owned videos", () => {
  const result = buildClientDashboard(
    2,
    [
      ...dashboardProjects,
      { id: 5, clientId: 2, name: "Second Project", status: "active", deadline: null },
    ],
    [
      video({ id: 1, projectId: 1, title: "Lone video in project 1" }),
      video({ id: 2, projectId: 5, title: "First of two in project 5" }),
      video({ id: 3, projectId: 5, title: "Second of two in project 5" }),
      video({
        id: 99,
        projectId: 9,
        clientId: 7,
        projectClientId: 7,
        title: "Other client's video, must not inflate this client's counts",
      }),
    ],
    [],
    NOW,
  );

  const byTitle = Object.fromEntries(result.allVideos.map((v) => [v.title, v]));
  assert.equal(byTitle["Lone video in project 1"].projectVideoCount, 1);
  assert.equal(byTitle["First of two in project 5"].projectVideoCount, 2);
  assert.equal(byTitle["Second of two in project 5"].projectVideoCount, 2);
});

test("projectVideoCount is null for a video with no project", () => {
  const result = buildClientDashboard(
    2,
    dashboardProjects,
    [video({ id: 1, projectId: null, title: "Unassigned" })],
    [],
    NOW,
  );
  assert.equal(result.allVideos[0].projectVideoCount, null);
});

test("buildClientVideoDetail carries the project video count through to the card", () => {
  const detail = buildClientVideoDetail(
    video({ id: 1, projectId: 1, title: "Solo" }),
    new Map([[1, "Launch Campaign"]]),
    null,
    1,
  );
  assert.equal(detail.projectVideoCount, 1);

  const detailWithSiblings = buildClientVideoDetail(
    video({ id: 2, projectId: 5, title: "Has a sibling" }),
    new Map([[5, "Other Project"]]),
    null,
    2,
  );
  assert.equal(detailWithSiblings.projectVideoCount, 2);
});


// Pre-Operation Reality Hardening §3 — Client Portal is a public
// projection, not CRM. toCard is the one place a video row becomes what
// the client actually receives; it already builds a brand-new object
// literal naming only the allowed fields rather than spreading the row,
// which is what makes this safe -- but that safety was never asserted as
// a standing regression test until now. This test feeds toCard a row that
// ALSO carries internal-only fields no real query should ever select for
// the client portal (trackedSeconds, effectiveRate, margin, cost,
// internalNotes, businessFinance, personalFinance) and proves none of
// them survive onto the card. If a future edit ever changes toCard to
// spread `...video` instead of naming fields, this test fails immediately.
test("toCard never leaks internal/financial fields onto the client-facing card", () => {
  const contaminatedRow = {
    id: 1,
    projectId: 10,
    clientId: 2,
    projectClientId: 2,
    title: "Landing Page",
    date: "2026-08-20",
    status: "READY_FOR_REVIEW",
    deliveryUrl: null,
    reviewUrl: "https://frame.io/review/abc",
    publishedUrl: null,
    coverUrl: null,
    projectCoverUrl: null,
    orientation: "LANDSCAPE",
    contentType: "short-form",
    isPriority: false,
    createdAt: new Date("2026-08-20T00:00:00Z"),
    updatedAt: new Date("2026-08-20T00:00:00Z"),
    // Forbidden fields per §3 -- must never reach the client. A real
    // query never selects these, but this row simulates what would leak
    // if toCard ever spread the row instead of naming its fields.
    trackedSeconds: 1080,
    trackedProductionSeconds: 1080,
    effectiveRate: 33333,
    effectiveProductionRate: 33333,
    margin: 0.62,
    profit: 62,
    cost: 38,
    internalNotes: "client is difficult, charge more next time",
    agreedPriceCents: 10000,
    hourlyRate: 45,
  };

  const card = toCard(contaminatedRow, new Map());

  const FORBIDDEN_KEYS = [
    "trackedSeconds",
    "trackedProductionSeconds",
    "effectiveRate",
    "effectiveProductionRate",
    "margin",
    "profit",
    "cost",
    "internalNotes",
    "agreedPriceCents",
    "hourlyRate",
  ];
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(card, key),
      false,
      `client card must never carry "${key}"`,
    );
  }

  // Sanity check: the allowed fields are still there -- this isn't
  // passing because toCard returned an empty object.
  assert.equal(card.id, 1);
  assert.equal(card.reviewUrl, "https://frame.io/review/abc");
});
