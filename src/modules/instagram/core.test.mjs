import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeInstagramUsername,
  validateInstagramProfileInput,
} from "./core.ts";

test("Instagram usernames normalize from handles and profile URLs", () => {
  assert.equal(normalizeInstagramUsername(" @RMedia.Edit "), "rmedia.edit");
  assert.equal(
    normalizeInstagramUsername("https://www.instagram.com/RMedia.Edit/"),
    "rmedia.edit",
  );
  assert.equal(normalizeInstagramUsername("https://example.com/user"), null);
});

test("Instagram profile fields allow bounded manual fallback data", () => {
  const result = validateInstagramProfileInput({
    username: "@lead",
    biography: "  Filmmaker  ",
    profilePictureUrl: "https://cdn.example.test/photo.jpg",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, {
      username: "lead",
      biography: "Filmmaker",
      profilePictureUrl: "https://cdn.example.test/photo.jpg",
    });
  }
  assert.equal(
    validateInstagramProfileInput({
      username: "lead",
      profilePictureUrl: "javascript:alert(1)",
    }).success,
    false,
  );
});
