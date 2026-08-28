import assert from "node:assert/strict";
import test from "node:test";
import {
  COVER_MAX_BYTES,
  buildCoverObjectKey,
  buildCoverRoute,
  coverObjectKeyFromRoute,
  detectCoverContentType,
  isSafeCoverObjectKey,
  resolveCoverUrl,
  validateCoverUploadMetadata,
} from "./core.ts";

test("resolveCoverUrl returns the first truthy candidate in order", () => {
  assert.equal(
    resolveCoverUrl("video-cover", "project-cover", "client-avatar"),
    "video-cover",
  );
  assert.equal(resolveCoverUrl(null, "project-cover", "client-avatar"), "project-cover");
  assert.equal(resolveCoverUrl(null, undefined, "client-avatar"), "client-avatar");
});

test("resolveCoverUrl returns null when every candidate is empty", () => {
  assert.equal(resolveCoverUrl(), null);
  assert.equal(resolveCoverUrl(null, undefined, "", null), null);
});

test("resolveCoverUrl treats an empty string the same as null/undefined", () => {
  assert.equal(resolveCoverUrl("", "project-cover"), "project-cover");
});

test("cover upload metadata accepts PNG/JPEG/WEBP and rejects invalid or oversized files", () => {
  for (const contentType of ["image/png", "image/jpeg", "image/webp"]) {
    assert.equal(validateCoverUploadMetadata({ size: 100, contentType }), null);
  }
  assert.match(
    validateCoverUploadMetadata({ size: 100, contentType: "image/gif" }) ?? "",
    /PNG, JPEG, or WEBP/i,
  );
  assert.match(
    validateCoverUploadMetadata({ size: COVER_MAX_BYTES + 1, contentType: "image/png" }) ?? "",
    /5 MB/i,
  );
});

test("cover file signatures are detected independently of the browser MIME label", () => {
  assert.equal(
    detectCoverContentType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(detectCoverContentType(Uint8Array.from([0xff, 0xd8, 0xff])), "image/jpeg");
  assert.equal(
    detectCoverContentType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    "image/webp",
  );
  assert.equal(detectCoverContentType(new TextEncoder().encode("not an image")), null);
});

test("uploaded covers expose only an opaque application route", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const objectKey = buildCoverObjectKey("image/png", id);
  assert.equal(objectKey, `covers/${id}.png`);
  assert.equal(isSafeCoverObjectKey(objectKey), true);
  const route = buildCoverRoute(objectKey);
  assert.equal(route, `/mindbunker/media/${objectKey}`);
  assert.equal(coverObjectKeyFromRoute(route), objectKey);
  assert.equal(coverObjectKeyFromRoute("https://cdn.example.com/cover.png"), null);
  assert.equal(isSafeCoverObjectKey("../private/secret"), false);
});
