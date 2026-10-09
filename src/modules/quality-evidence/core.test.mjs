import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQualityEvidenceMediaUrl,
  buildQualityEvidenceObjectKey,
  clampPlaybackPosition,
  detectQualityEvidenceContentType,
  isCompleteQualityEvidence,
  isQualityEvidenceObjectKey,
  validateQualityEvidenceInput,
  validateQualityEvidenceUpload,
} from "./core.ts";

test("explicit pairs accept complete and incomplete internal evidence without using filenames as truth", () => {
  const complete = validateQualityEvidenceInput({
    videoId: 11,
    type: "IMAGE_COMPARISON",
    label: "Color correction",
    beforeReference: "https://media.example/before",
    afterReference: "https://media.example/after",
    visibility: "CLIENT_SAFE",
  });
  assert.equal(complete.success, true);
  assert.equal(isCompleteQualityEvidence(complete.value), true);

  const missingAfter = validateQualityEvidenceInput({
    videoId: 11,
    type: "IMAGE_COMPARISON",
    label: "Color correction",
    beforeReference: "https://media.example/an-opaque-reference",
    visibility: "INTERNAL_ONLY",
  });
  assert.equal(missingAfter.success, true);
  assert.equal(isCompleteQualityEvidence(missingAfter.value), false);

  const missingBefore = validateQualityEvidenceInput({
    videoId: 11,
    type: "AUDIO_COMPARISON",
    label: "Audio finish",
    afterReference: "https://media.example/another-opaque-reference",
    visibility: "INTERNAL_ONLY",
  });
  assert.equal(missingBefore.success, true);
  assert.equal(isCompleteQualityEvidence(missingBefore.value), false);
});

test("quality evidence rejects empty pairs and unsafe references", () => {
  assert.equal(validateQualityEvidenceInput({ videoId: 1, type: "IMAGE_COMPARISON", label: "x", visibility: "INTERNAL_ONLY" }).success, false);
  assert.equal(validateQualityEvidenceInput({ videoId: 1, type: "IMAGE_COMPARISON", label: "x", beforeReference: "file:///private", visibility: "INTERNAL_ONLY" }).success, false);
});

test("image and audio uploads have narrow type and size contracts", () => {
  assert.equal(validateQualityEvidenceUpload({ type: "IMAGE_COMPARISON", size: 100, contentType: "image/png" }), null);
  assert.match(validateQualityEvidenceUpload({ type: "IMAGE_COMPARISON", size: 100, contentType: "audio/mpeg" }) ?? "", /image evidence/i);
  assert.equal(validateQualityEvidenceUpload({ type: "AUDIO_COMPARISON", size: 100, contentType: "audio/mpeg" }), null);
  assert.match(validateQualityEvidenceUpload({ type: "AUDIO_COMPARISON", size: 100, contentType: "image/png" }) ?? "", /audio evidence/i);
});

test("file signatures are detected independently of filenames", () => {
  assert.equal(detectQualityEvidenceContentType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectQualityEvidenceContentType(Uint8Array.from([0x49, 0x44, 0x33])), "audio/mpeg");
  assert.equal(detectQualityEvidenceContentType(new TextEncoder().encode("not media")), null);
});

test("private object keys and authenticated media routes stay opaque", () => {
  const key = buildQualityEvidenceObjectKey("audio/mpeg", "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(key, "quality-evidence/123e4567-e89b-42d3-a456-426614174000.mp3");
  assert.equal(isQualityEvidenceObjectKey(key), true);
  assert.equal(isQualityEvidenceObjectKey("../secret.mp3"), false);
  assert.equal(buildQualityEvidenceMediaUrl(7, "before", "operator"), "/mindbunker/api/quality-evidence/7/media/before");
  assert.equal(buildQualityEvidenceMediaUrl(7, "after", "client"), "/mindbunker/client/api/quality-evidence/7/media/after");
});

test("audio switching clamps the preserved position safely", () => {
  assert.equal(clampPlaybackPosition(30, 60), 30);
  assert.equal(clampPlaybackPosition(90, 60), 59.95);
  assert.equal(clampPlaybackPosition(-1, 60), 0);
});
