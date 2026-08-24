import assert from "node:assert/strict";
import test from "node:test";

import {
  validateAssetInput,
  validateSourceMediaReferenceInput,
} from "./core.ts";

test("validateAssetInput requires a project but NOT a video (§3 asset independence)", () => {
  const result = validateAssetInput({
    projectId: 7,
    name: "Look Studios source ingest",
    type: "SOURCE_PREP",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.value.projectId, 7);
    assert.equal(result.value.videoId, null);
    assert.equal(result.value.status, "DRAFT");
  }
});

test("validateAssetInput rejects a missing project", () => {
  const result = validateAssetInput({ projectId: null, name: "x", type: "FINAL_DELIVERABLE" });
  assert.equal(result.success, false);
});

test("validateAssetInput accepts an optional video relation", () => {
  const result = validateAssetInput({
    projectId: 7,
    videoId: 42,
    name: "Taryn's Cut 1.0",
    type: "CLIENT_REVIEW",
    reviewUrl: "https://frame.io/review/1",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.value.videoId, 42);
    assert.equal(result.value.reviewUrl, "https://frame.io/review/1");
  }
});

test("validateAssetInput rejects an unknown asset type", () => {
  const result = validateAssetInput({ projectId: 1, name: "x", type: "NOT_A_REAL_TYPE" });
  assert.equal(result.success, false);
});

test("validateAssetInput rejects a non-HTTPS review URL", () => {
  const result = validateAssetInput({
    projectId: 1,
    name: "x",
    type: "UTILITY_ASSET",
    reviewUrl: "http://insecure.example.com/review",
  });
  assert.equal(result.success, false);
});

test("validateAssetInput trims blank optional fields to null rather than empty strings", () => {
  const result = validateAssetInput({
    projectId: 1,
    name: "  Full Cut  ",
    type: "FINAL_DELIVERABLE",
    notes: "   ",
    source: "",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.value.name, "Full Cut");
    assert.equal(result.value.notes, null);
    assert.equal(result.value.source, null);
  }
});

test("validateSourceMediaReferenceInput keeps approxSizeLabel as a free-text estimate, never a parsed number", () => {
  const result = validateSourceMediaReferenceInput({
    projectId: 3,
    approxSizeLabel: "~800 GB",
    location: "NAS / Dropbox",
    profile: "LOG",
    notes: "downloaded via shell to RMEDIA NAS",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(typeof result.value.approxSizeLabel, "string");
    assert.equal(result.value.approxSizeLabel, "~800 GB");
  }
});

test("validateSourceMediaReferenceInput requires a project and tolerates all-unknown facts", () => {
  const missingProject = validateSourceMediaReferenceInput({ projectId: 0 });
  assert.equal(missingProject.success, false);

  const unknownFacts = validateSourceMediaReferenceInput({ projectId: 3 });
  assert.equal(unknownFacts.success, true);
  if (unknownFacts.success) {
    assert.equal(unknownFacts.value.approxSizeLabel, null);
    assert.equal(unknownFacts.value.location, null);
  }
});
