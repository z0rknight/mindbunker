import assert from "node:assert/strict";
import test from "node:test";

import {
  completedVideoLogs,
  computeRevisionCount,
  getVideoNextAction,
  getVideoMetadataChanges,
  groupOperationalVideos,
  planVideoTransition,
  validateCoverUrl,
  validateVideoAssignment,
  validateVideoCreateInput,
  validateDeliveryUrl,
  validateVideoInput,
  validateVideoPriorityInput,
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
      reviewUrl: null,
      publishedUrl: null,
      notes: "Vertical version",
      coverUrl: null,
      orientation: null,
      contentType: null,
      date: null,
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
  // NORMAL prospective single-video creation (allowExplicitStatus unset) --
  // unchanged: must start PLANNED, exactly as every prior round.
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

// Brief C ("Final Local Ingest / Live Readiness") §3: EXPLICIT
// historical/bulk ingest (allowExplicitStatus: true) may create a Video
// directly in a later canonical lifecycle stage -- deliberately a
// different, narrower carve-out than the test above, not a replacement of
// it. Absence of a valid status is still always rejected, never silently
// inferred as completion.
test("explicit historical/bulk ingest may set a later canonical status, but never silently", () => {
  const delivered = validateVideoCreateInput({
    title: "August delivered cut",
    projectId: 4,
    status: "DONE",
    allowExplicitStatus: true,
  });
  assert.equal(delivered.success, true);
  assert.equal(delivered.data.status, "DONE");

  const inProgress = validateVideoCreateInput({
    title: "August WIP cut",
    projectId: 4,
    status: "IN_PROGRESS",
    allowExplicitStatus: true,
  });
  assert.equal(inProgress.success, true);
  assert.equal(inProgress.data.status, "IN_PROGRESS");

  // Still PLANNED-safe by explicit choice, not by silent inference.
  const planned = validateVideoCreateInput({
    title: "August planned cut",
    projectId: 4,
    status: "PLANNED",
    allowExplicitStatus: true,
  });
  assert.equal(planned.success, true);
  assert.equal(planned.data.status, "PLANNED");

  // An invalid/garbage status is rejected outright -- never defaulted to
  // anything, completed or otherwise.
  assert.equal(
    validateVideoCreateInput({
      title: "Bad status",
      projectId: 4,
      status: "NOT_A_REAL_STATUS",
      allowExplicitStatus: true,
    }).success,
    false,
  );

  // The single-create (non-bulk) invariant is untouched by the flag's mere
  // presence when it's false -- same as the test above, re-asserted here
  // for the explicit-vs-implicit contrast.
  assert.equal(
    validateVideoCreateInput({
      title: "Still must be planned",
      projectId: 4,
      status: "DONE",
      allowExplicitStatus: false,
    }).success,
    false,
  );
});

// "Final Single Video Ingest Gap" round §5/§10: Add Video (and Add Multiple
// Videos, which shares this exact validator) can create a Video directly
// in READY_FOR_REVIEW, but the same "no AWAITING_CLIENT_APPROVAL without a
// review URL" invariant that already governs status TRANSITIONS
// (planVideoTransition) must hold here too -- otherwise a video could be
// born in that state with no review link.
test("explicit historical create into READY_FOR_REVIEW still requires a review URL", () => {
  const withoutReviewUrl = validateVideoCreateInput({
    title: "Needs review",
    projectId: 4,
    status: "READY_FOR_REVIEW",
    allowExplicitStatus: true,
  });
  assert.equal(withoutReviewUrl.success, false);

  const withReviewUrl = validateVideoCreateInput({
    title: "Needs review",
    projectId: 4,
    status: "READY_FOR_REVIEW",
    reviewUrl: "https://frame.io/review/123",
    allowExplicitStatus: true,
  });
  assert.equal(withReviewUrl.success, true);
});

// §6: for statuses where a review URL isn't required (PLANNED, DONE, ...),
// every URL field stays genuinely optional -- an explicit historical
// create with no links at all must still succeed.
test("optional URLs remain optional for statuses that don't require one", () => {
  const planned = validateVideoCreateInput({
    title: "No links yet",
    projectId: 4,
    status: "PLANNED",
    allowExplicitStatus: true,
  });
  assert.equal(planned.success, true);
  assert.equal(planned.data.deliveryUrl, null);
  assert.equal(planned.data.reviewUrl, null);
  assert.equal(planned.data.publishedUrl, null);

  const done = validateVideoCreateInput({
    title: "Delivered, no link on file",
    projectId: 4,
    status: "DONE",
    allowExplicitStatus: true,
  });
  assert.equal(done.success, true);
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

test("project-local video creation derives the client from its locked project context", () => {
  assert.deepEqual(
    validateVideoAssignment({
      requestedClientId: null,
      projectId: 12,
      project: { clientId: 7, status: "active" },
    }),
    { success: true, clientId: 7 },
  );
});

test("project-local video creation cannot be redirected to an unrelated client", () => {
  const result = validateVideoAssignment({
    requestedClientId: 8,
    projectId: 12,
    project: { clientId: 7, status: "active" },
  });
  assert.equal(result.success, false);
  assert.match(result.error, /different client/);
});

test("global video creation without a project keeps its explicit client flow", () => {
  assert.deepEqual(
    validateVideoAssignment({
      requestedClientId: 7,
      projectId: null,
      project: null,
    }),
    { success: true, clientId: 7 },
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
      // Monday Real-Operation Pre-Freeze §5: entering READY_FOR_REVIEW
      // (this repo's AWAITING_CLIENT_APPROVAL) requires a review URL --
      // supply one here so this vocabulary-coverage test still exercises
      // every transition; the invariant itself is tested separately below.
      reviewUrl:
        targetStatus === "READY_FOR_REVIEW" ? "https://example.com/review" : null,
    });
    assert.equal(result.success, true);
    if (result.success && result.changed) {
      assert.equal(result.eventType, eventType);
      assert.equal(result.delivered, targetStatus === "DONE");
    }
  }
});

test("a video cannot enter READY_FOR_REVIEW (AWAITING_CLIENT_APPROVAL) without a review URL", () => {
  const withoutUrl = planVideoTransition({
    currentStatus: "IN_PROGRESS",
    expectedStatus: "IN_PROGRESS",
    targetStatus: "READY_FOR_REVIEW",
  });
  assert.equal(withoutUrl.success, false);

  const withBlankUrl = planVideoTransition({
    currentStatus: "IN_PROGRESS",
    expectedStatus: "IN_PROGRESS",
    targetStatus: "READY_FOR_REVIEW",
    reviewUrl: "   ",
  });
  assert.equal(withBlankUrl.success, false);

  const withUrl = planVideoTransition({
    currentStatus: "IN_PROGRESS",
    expectedStatus: "IN_PROGRESS",
    targetStatus: "READY_FOR_REVIEW",
    reviewUrl: "https://frame.io/review/abc",
  });
  assert.equal(withUrl.success, true);

  // Transitions that do NOT target READY_FOR_REVIEW are unaffected by a
  // missing reviewUrl -- the invariant is scoped to that one transition.
  const unaffected = planVideoTransition({
    currentStatus: "READY_FOR_REVIEW",
    expectedStatus: "READY_FOR_REVIEW",
    targetStatus: "DONE",
  });
  assert.equal(unaffected.success, true);
});


test("cover URL follows the exact same HTTPS-only discipline as delivery URL", () => {
  assert.deepEqual(validateCoverUrl(""), { success: true, value: null });
  assert.deepEqual(validateCoverUrl(null), { success: true, value: null });
  assert.deepEqual(validateCoverUrl("https://cdn.example.com/cover.jpg"), {
    success: true,
    value: "https://cdn.example.com/cover.jpg",
  });
  assert.deepEqual(
    validateCoverUrl("/mindbunker/media/covers/123e4567-e89b-42d3-a456-426614174000.png"),
    {
      success: true,
      value: "/mindbunker/media/covers/123e4567-e89b-42d3-a456-426614174000.png",
    },
  );

  for (const unsafe of [
    "http://example.com/cover.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,aaaa",
    "file:///etc/passwd",
    "https://user:pass@example.com/cover.jpg",
  ]) {
    assert.equal(validateCoverUrl(unsafe).success, false, unsafe);
  }
});

test("video visual metadata (cover/orientation/content type) is optional and validated together", () => {
  const valid = validateVideoInput({
    title: "Reel",
    coverUrl: "https://cdn.example.com/reel.jpg",
    orientation: "VERTICAL",
    contentType: "short-form",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.coverUrl, "https://cdn.example.com/reel.jpg");
    assert.equal(valid.data.orientation, "VERTICAL");
    assert.equal(valid.data.contentType, "short-form");
  }

  // Omitted entirely -- must default to null (unknown), never inferred.
  const omitted = validateVideoInput({ title: "Reel" });
  assert.equal(omitted.success, true);
  if (omitted.success) {
    assert.equal(omitted.data.coverUrl, null);
    assert.equal(omitted.data.orientation, null);
    assert.equal(omitted.data.contentType, null);
  }

  // Invalid enum values are rejected outright, not silently coerced.
  assert.equal(
    validateVideoInput({ title: "Reel", orientation: "DIAGONAL" }).success,
    false,
  );
  assert.equal(
    validateVideoInput({ title: "Reel", contentType: "vlog" }).success,
    false,
  );
  assert.equal(
    validateVideoInput({ title: "Reel", coverUrl: "javascript:alert(1)" }).success,
    false,
  );
});

// Lunch Reality Patch P1 §7: client-settable "priority now" video, one per
// project.
test("validateVideoPriorityInput: marking priority requires the video to belong to a project", () => {
  assert.match(validateVideoPriorityInput(true, null) ?? "", /project/i);
  assert.equal(validateVideoPriorityInput(true, 42), null);
});

test("validateVideoPriorityInput: clearing priority never requires a project", () => {
  assert.equal(validateVideoPriorityInput(false, null), null);
  assert.equal(validateVideoPriorityInput(false, 42), null);
});

test("computeRevisionCount: counts the revisions rows belonging to one video", () => {
  const rows = [{ videoId: 1 }, { videoId: 1 }, { videoId: 2 }];
  assert.equal(computeRevisionCount(rows.filter((r) => r.videoId === 1)), 2);
});

test("computeRevisionCount: zero rows is an honest 0", () => {
  assert.equal(computeRevisionCount([]), 0);
});
