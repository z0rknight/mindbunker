import assert from "node:assert/strict";
import test from "node:test";

import {
  VIDEO_OPERATIONAL_NOTE_MAX_LENGTH,
  isVideoMemoryVideoId,
  newestVideoMemoryFirst,
  validateVideoOperationalNote,
  videoOperationalMemoryBlocksDeletion,
} from "./core.ts";

test("operational memory accepts one low-friction bounded note", () => {
  assert.deepEqual(validateVideoOperationalNote("  Rough cut assembled  "), {
    success: true,
    body: "Rough cut assembled",
  });
  assert.equal(validateVideoOperationalNote("").success, false);
  assert.equal(
    validateVideoOperationalNote("x".repeat(VIDEO_OPERATIONAL_NOTE_MAX_LENGTH + 1)).success,
    false,
  );
});

test("video memory identifiers and deletion protection fail closed", () => {
  assert.equal(isVideoMemoryVideoId(1), true);
  assert.equal(isVideoMemoryVideoId(0), false);
  assert.equal(isVideoMemoryVideoId(-1), false);
  assert.equal(isVideoMemoryVideoId(1.2), false);
  assert.equal(videoOperationalMemoryBlocksDeletion(0), false);
  assert.equal(videoOperationalMemoryBlocksDeletion(1), true);
});

test("newest-first chronology is deterministic when timestamps tie", () => {
  const entries = [
    { id: 1, body: "First", createdAt: "2026-08-22T10:00:00.000Z" },
    { id: 3, body: "Third", createdAt: "2026-08-22T11:00:00.000Z" },
    { id: 2, body: "Second", createdAt: "2026-08-22T11:00:00.000Z" },
  ];
  assert.deepEqual(newestVideoMemoryFirst(entries).map(({ id }) => id), [3, 2, 1]);
  assert.deepEqual(entries.map(({ id }) => id), [1, 3, 2]);
});
